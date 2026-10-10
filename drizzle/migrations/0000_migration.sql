CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  operator text CHECK (operator IN ('orange','mtn','moov','wave')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator text NOT NULL CHECK (operator IN ('orange','mtn','moov','wave')),
  kind text NOT NULL CHECK (kind IN ('internet','appels','mixte')),
  name text NOT NULL,
  description text NOT NULL,
  validity text NOT NULL,
  price integer NOT NULL CHECK (price > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable" ON public.plans FOR SELECT TO anon, authenticated USING (active);

INSERT INTO public.plans (operator, kind, name, description, validity, price) VALUES
('orange','internet','Pass Jour 1 Go','1 Go d''internet','24 heures',500),
('orange','internet','Pass Semaine 5 Go','5 Go d''internet','7 jours',2000),
('orange','appels','Pass Appels 30 min','30 minutes vers tous réseaux','3 jours',500),
('orange','mixte','Pass Mix 3 Go + 60 min','3 Go et 60 minutes','30 jours',5000),
('mtn','internet','Pass Jour 1,5 Go','1,5 Go d''internet','24 heures',500),
('mtn','internet','Pass Mois 15 Go','15 Go d''internet','30 jours',10000),
('mtn','appels','Pass Appels 60 min','60 minutes tous réseaux','7 jours',1000),
('mtn','mixte','Pass Mix 2 Go + 30 min','2 Go et 30 minutes','7 jours',2000),
('moov','internet','Pass Jour 800 Mo','800 Mo d''internet','24 heures',300),
('moov','internet','Pass Semaine 4 Go','4 Go d''internet','7 jours',1500),
('moov','appels','Pass Appels 100 min','100 minutes tous réseaux','30 jours',2500),
('moov','mixte','Pass Mix 6 Go + 100 min','6 Go et 100 minutes','30 jours',7500),
('wave','mixte','Pack Wave 1 Go + 20 min','1 Go et 20 minutes','7 jours',1000);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('forfait','recharge')),
  plan_id uuid REFERENCES public.plans(id),
  label text NOT NULL,
  operator text NOT NULL,
  phone text NOT NULL,
  amount integer NOT NULL,
  fee integer NOT NULL,
  total integer NOT NULL,
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','error')),
  reference text NOT NULL UNIQUE,
  jeko_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_idx ON public.transactions(user_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TABLE public.cabiniste_members (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cabiniste_members TO authenticated;
GRANT ALL ON public.cabiniste_members TO service_role;
ALTER TABLE public.cabiniste_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cabiniste_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  available boolean NOT NULL DEFAULT true,
  stock integer NOT NULL DEFAULT 15000,
  bonuses integer NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cabiniste_state TO authenticated;
GRANT ALL ON public.cabiniste_state TO service_role;
ALTER TABLE public.cabiniste_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_cabiniste(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.cabiniste_members WHERE user_id = _user_id
  );
$$;
REVOKE ALL ON FUNCTION public.is_cabiniste(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_cabiniste(uuid) TO authenticated, service_role;

CREATE POLICY "cabinistes read own membership"
ON public.cabiniste_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cabinistes read service state"
ON public.cabiniste_state FOR SELECT TO authenticated
USING (public.is_cabiniste(auth.uid()));

CREATE POLICY "cabinistes read paid orders"
ON public.transactions FOR SELECT TO authenticated
USING (public.is_cabiniste(auth.uid()));

CREATE OR REPLACE FUNCTION public.service_is_open()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT available FROM public.cabiniste_state WHERE id = true), true);
$$;
REVOKE ALL ON FUNCTION public.service_is_open() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_is_open() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cabiniste_set_availability(p_user uuid, p_available boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_cabiniste(p_user) THEN RAISE EXCEPTION 'Accès réservé au cabiniste'; END IF;
  INSERT INTO public.cabiniste_state(id, available, updated_by)
  VALUES(true, p_available, p_user)
  ON CONFLICT(id) DO UPDATE
  SET available = p_available, updated_by = p_user, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.cabiniste_set_availability(uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cabiniste_set_availability(uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.cabiniste_deliver(p_user uuid, p_transaction uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t public.transactions; s public.cabiniste_state;
BEGIN
  IF NOT public.is_cabiniste(p_user) THEN RAISE EXCEPTION 'Accès réservé au cabiniste'; END IF;
  SELECT * INTO t FROM public.transactions
  WHERE id = p_transaction AND status IN ('success', 'paid', 'pending_delivery')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable ou déjà traitée'; END IF;

  INSERT INTO public.cabiniste_state(id, updated_by) VALUES(true, p_user) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO s FROM public.cabiniste_state WHERE id = true FOR UPDATE;
  IF s.stock < t.amount THEN RAISE EXCEPTION 'Stock insuffisant pour cette commande'; END IF;

  UPDATE public.transactions
  SET status = 'delivered', delivered_at = now(), updated_at = now(), admin_note = NULL
  WHERE id = t.id;
  UPDATE public.cabiniste_state
  SET stock = stock - t.amount, bonuses = bonuses + 5, updated_by = p_user, updated_at = now()
  WHERE id = true
  RETURNING * INTO s;

  RETURN jsonb_build_object('available', s.available, 'stock', s.stock, 'bonuses', s.bonuses);
END;
$$;
REVOKE ALL ON FUNCTION public.cabiniste_deliver(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cabiniste_deliver(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cabiniste_report_issue(p_user uuid, p_transaction uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE tid uuid;
BEGIN
  IF NOT public.is_cabiniste(p_user) THEN RAISE EXCEPTION 'Accès réservé au cabiniste'; END IF;
  IF p_reason NOT IN ('Numéro invalide', 'Panne réseau opérateur', 'Stock insuffisant') THEN
    RAISE EXCEPTION 'Motif invalide';
  END IF;
  UPDATE public.transactions
  SET status = 'issue', admin_note = p_reason, updated_at = now()
  WHERE id = p_transaction AND status IN ('success', 'paid', 'pending_delivery')
  RETURNING id INTO tid;
  IF tid IS NULL THEN RAISE EXCEPTION 'Commande introuvable ou déjà traitée'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cabiniste_report_issue(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cabiniste_report_issue(uuid,uuid,text) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cabiniste_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cabiniste_state;
  END IF;
END;
$$;
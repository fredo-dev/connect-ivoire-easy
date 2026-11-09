CREATE TABLE public.quiz_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id), questions jsonb NOT NULL, answers jsonb NOT NULL DEFAULT '[]', earned integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.quiz_sessions TO service_role;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.quiz_withdrawals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, amount integer NOT NULL, phone text NOT NULL, operator text NOT NULL, status text NOT NULL DEFAULT 'pending', payment_reference text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.quiz_withdrawals TO authenticated;
GRANT ALL ON public.quiz_withdrawals TO service_role;
ALTER TABLE public.quiz_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own withdrawals" ON public.quiz_withdrawals FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TABLE public.quiz_prizes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL DEFAULT '', starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT false, winner_id uuid, awarded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT prize_dates CHECK (ends_at>starts_at));
GRANT SELECT ON public.quiz_prizes TO authenticated;
GRANT ALL ON public.quiz_prizes TO service_role;
ALTER TABLE public.quiz_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published prizes" ON public.quiz_prizes FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.quiz_start(p_user uuid, p_transaction uuid, p_questions jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sid uuid; BEGIN
PERFORM 1 FROM public.transactions WHERE id=p_transaction AND user_id=p_user AND kind='forfait' AND status='success' FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Une souscription payée est nécessaire.'; END IF;
IF jsonb_array_length(p_questions)<>20 THEN RAISE EXCEPTION '20 questions requises'; END IF;
INSERT INTO public.quiz_sessions(user_id,transaction_id,questions) VALUES(p_user,p_transaction,p_questions) ON CONFLICT(transaction_id) DO NOTHING;
SELECT id INTO sid FROM public.quiz_sessions WHERE transaction_id=p_transaction AND user_id=p_user; RETURN sid; END $$;
REVOKE ALL ON FUNCTION public.quiz_start(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.quiz_start(uuid,uuid,jsonb) TO service_role;
CREATE FUNCTION public.quiz_answer(p_user uuid,p_session uuid,p_index integer,p_choice integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.quiz_sessions; q jsonb; good boolean; BEGIN
SELECT * INTO s FROM public.quiz_sessions WHERE id=p_session AND user_id=p_user FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Partie introuvable'; END IF;
IF p_index<>jsonb_array_length(s.answers) OR p_index>=20 OR p_choice<0 OR p_choice>3 THEN RAISE EXCEPTION 'Cette question a déjà été jouée ou est invalide'; END IF;
q:=s.questions->p_index; good:=(q->>'correct')::integer=p_choice;
UPDATE public.quiz_sessions SET answers=answers || jsonb_build_array(jsonb_build_object('choice',p_choice,'correct',good)), earned=earned+CASE WHEN good THEN 10 ELSE 0 END WHERE id=s.id;
RETURN jsonb_build_object('correct',good,'correctChoice',(q->>'correct')::integer,'explanation',q->>'explanation','reward',CASE WHEN good THEN 10 ELSE 0 END); END $$;
REVOKE ALL ON FUNCTION public.quiz_answer(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.quiz_answer(uuid,uuid,integer,integer) TO service_role;
CREATE FUNCTION public.quiz_withdraw(p_user uuid,p_phone text,p_operator text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE balance integer; wid uuid; BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
SELECT coalesce(sum(earned),0)-(SELECT coalesce(sum(amount),0) FROM public.quiz_withdrawals WHERE user_id=p_user AND status IN ('pending','paid')) INTO balance FROM public.quiz_sessions WHERE user_id=p_user;
IF balance<=0 THEN RAISE EXCEPTION 'Aucun gain disponible'; END IF;
IF p_phone !~ '^\+225[0-9]{10}$' OR p_operator NOT IN ('orange','mtn','moov','wave') THEN RAISE EXCEPTION 'Numéro ou opérateur invalide'; END IF;
INSERT INTO public.quiz_withdrawals(user_id,amount,phone,operator) VALUES(p_user,balance,p_phone,p_operator) RETURNING id INTO wid; RETURN wid; END $$;
REVOKE ALL ON FUNCTION public.quiz_withdraw(uuid,text,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.quiz_withdraw(uuid,text,text) TO service_role;
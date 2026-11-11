ALTER TABLE public.quiz_sessions ADD COLUMN question_deadline timestamptz;
ALTER TABLE public.quiz_sessions ADD COLUMN finished_at timestamptz;
ALTER TABLE public.quiz_sessions ADD COLUMN finish_reason text;

UPDATE public.quiz_sessions
SET finished_at = COALESCE(finished_at, created_at), finish_reason = 'completed'
WHERE jsonb_array_length(answers) >= 20 AND finished_at IS NULL;

UPDATE public.quiz_sessions
SET question_deadline = now() + interval '15 seconds'
WHERE finished_at IS NULL AND question_deadline IS NULL;

CREATE OR REPLACE FUNCTION public.quiz_expire(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.quiz_sessions
  SET finished_at = now(), finish_reason = 'timeout'
  WHERE user_id = p_user
    AND finished_at IS NULL
    AND question_deadline IS NOT NULL
    AND question_deadline <= now();
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_expire(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_expire(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.quiz_start(p_user uuid, p_transaction uuid, p_questions jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE sid uuid;
BEGIN
  PERFORM 1 FROM public.transactions
  WHERE id = p_transaction AND user_id = p_user AND kind = 'forfait' AND status = 'success'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Une souscription payée est nécessaire.'; END IF;
  IF jsonb_array_length(p_questions) <> 20 THEN RAISE EXCEPTION '20 questions requises'; END IF;

  INSERT INTO public.quiz_sessions(user_id, transaction_id, questions, question_deadline)
  VALUES(p_user, p_transaction, p_questions, now() + interval '15 seconds')
  ON CONFLICT(transaction_id) DO NOTHING;

  SELECT id INTO sid FROM public.quiz_sessions
  WHERE transaction_id = p_transaction AND user_id = p_user;

  UPDATE public.quiz_sessions
  SET finished_at = now(), finish_reason = 'timeout'
  WHERE id = sid AND finished_at IS NULL
    AND question_deadline IS NOT NULL AND question_deadline <= now();

  RETURN sid;
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_start(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_start(uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.quiz_next(p_user uuid, p_session uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE s public.quiz_sessions;
BEGIN
  SELECT * INTO s FROM public.quiz_sessions
  WHERE id = p_session AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partie introuvable'; END IF;
  IF s.finished_at IS NOT NULL THEN RAISE EXCEPTION 'Partie terminée'; END IF;
  IF jsonb_array_length(s.answers) >= 20 THEN
    UPDATE public.quiz_sessions SET finished_at = now(), finish_reason = 'completed' WHERE id = s.id;
    RETURN;
  END IF;
  IF s.question_deadline IS NOT NULL AND s.question_deadline <= now() THEN
    UPDATE public.quiz_sessions SET finished_at = now(), finish_reason = 'timeout' WHERE id = s.id;
    RETURN;
  END IF;
  IF s.question_deadline IS NULL THEN
    UPDATE public.quiz_sessions SET question_deadline = now() + interval '15 seconds' WHERE id = s.id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_next(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_next(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.quiz_answer(p_user uuid, p_session uuid, p_index integer, p_choice integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE s public.quiz_sessions; q jsonb; good boolean;
BEGIN
  SELECT * INTO s FROM public.quiz_sessions
  WHERE id = p_session AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partie introuvable'; END IF;
  IF s.finished_at IS NOT NULL THEN RAISE EXCEPTION 'Partie terminée'; END IF;
  IF p_index <> jsonb_array_length(s.answers) OR p_index >= 20 OR p_choice < 0 OR p_choice > 3 THEN
    RAISE EXCEPTION 'Cette question a déjà été jouée ou est invalide';
  END IF;
  IF s.question_deadline IS NULL THEN RAISE EXCEPTION 'Cette question n’est pas active'; END IF;
  IF s.question_deadline <= now() THEN
    UPDATE public.quiz_sessions SET finished_at = now(), finish_reason = 'timeout' WHERE id = s.id;
    RETURN jsonb_build_object('expired', true);
  END IF;

  q := s.questions -> p_index;
  good := (q ->> 'correct')::integer = p_choice;
  UPDATE public.quiz_sessions
  SET answers = answers || jsonb_build_array(jsonb_build_object('choice', p_choice, 'correct', good)),
      earned = earned + CASE WHEN good THEN 10 ELSE 0 END,
      question_deadline = CASE WHEN p_index = 19 THEN question_deadline ELSE NULL END,
      finished_at = CASE WHEN p_index = 19 THEN now() ELSE NULL END,
      finish_reason = CASE WHEN p_index = 19 THEN 'completed' ELSE NULL END
  WHERE id = s.id;

  RETURN jsonb_build_object(
    'correct', good,
    'correctChoice', (q ->> 'correct')::integer,
    'explanation', q ->> 'explanation',
    'reward', CASE WHEN good THEN 10 ELSE 0 END,
    'expired', false
  );
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_answer(uuid,uuid,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_answer(uuid,uuid,integer,integer) TO service_role;
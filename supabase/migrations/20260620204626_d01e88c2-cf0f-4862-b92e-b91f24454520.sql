
CREATE TABLE public.practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game text NOT NULL,
  mode text NOT NULL DEFAULT '',
  terms integer[] NOT NULL,
  signs text[] NOT NULL,
  answer integer NOT NULL,
  user_answer integer,
  correct boolean NOT NULL,
  used_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.practice_attempts TO authenticated;
GRANT ALL ON public.practice_attempts TO service_role;

ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own attempts"
  ON public.practice_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own attempts"
  ON public.practice_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX practice_attempts_user_game_created_idx
  ON public.practice_attempts (user_id, game, created_at DESC);

CREATE INDEX practice_attempts_user_game_wrong_idx
  ON public.practice_attempts (user_id, game, created_at DESC)
  WHERE correct = false;

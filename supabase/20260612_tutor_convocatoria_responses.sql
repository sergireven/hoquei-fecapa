-- Tutor responses for convocatories
-- Allows authenticated tutors to save per-match availability for their favorite players

CREATE TABLE IF NOT EXISTS public.convocatoria_tutor_responses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_key        TEXT        NOT NULL,
  team_name        TEXT        NOT NULL DEFAULT '',
  competition_name TEXT        NOT NULL DEFAULT '',
  match_home       TEXT        NOT NULL DEFAULT '',
  match_away       TEXT        NOT NULL DEFAULT '',
  responses        JSONB       NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, match_key, team_name)
);

CREATE INDEX IF NOT EXISTS idx_tutor_responses_user    ON public.convocatoria_tutor_responses (user_id);
CREATE INDEX IF NOT EXISTS idx_tutor_responses_match   ON public.convocatoria_tutor_responses (match_key);
CREATE INDEX IF NOT EXISTS idx_tutor_responses_team    ON public.convocatoria_tutor_responses (team_name);

ALTER TABLE public.convocatoria_tutor_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tutor_responses: own read" ON public.convocatoria_tutor_responses;
DROP POLICY IF EXISTS "tutor_responses: own insert" ON public.convocatoria_tutor_responses;
DROP POLICY IF EXISTS "tutor_responses: own update" ON public.convocatoria_tutor_responses;
DROP POLICY IF EXISTS "tutor_responses: own delete" ON public.convocatoria_tutor_responses;

CREATE POLICY "tutor_responses: own read"
  ON public.convocatoria_tutor_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tutor_responses: own insert"
  ON public.convocatoria_tutor_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tutor_responses: own update"
  ON public.convocatoria_tutor_responses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tutor_responses: own delete"
  ON public.convocatoria_tutor_responses FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.convocatoria_tutor_responses IS 'Tutor availability responses per convocatoria match.';
COMMENT ON COLUMN public.convocatoria_tutor_responses.responses IS 'Array of {player_id, player_name, team_name, status, note}.';

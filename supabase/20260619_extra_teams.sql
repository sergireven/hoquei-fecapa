-- Extra (non-federated) teams created by coordinators/coaches for their club
-- These cover internal categories like Escoleta, Veterans, etc.
CREATE TABLE IF NOT EXISTS public.extra_teams (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_name      TEXT        NOT NULL,
  team_name      TEXT        NOT NULL,
  category       TEXT        NOT NULL DEFAULT 'No federat',
  coach_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coach_user_id, club_name, team_name)
);

CREATE INDEX IF NOT EXISTS idx_extra_teams_user  ON public.extra_teams (coach_user_id);
CREATE INDEX IF NOT EXISTS idx_extra_teams_club  ON public.extra_teams (club_name);

ALTER TABLE public.extra_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extra_teams: owner select"
  ON public.extra_teams FOR SELECT
  USING (auth.uid() = coach_user_id);

CREATE POLICY "extra_teams: owner insert"
  ON public.extra_teams FOR INSERT
  WITH CHECK (auth.uid() = coach_user_id);

CREATE POLICY "extra_teams: owner delete"
  ON public.extra_teams FOR DELETE
  USING (auth.uid() = coach_user_id);

COMMENT ON TABLE public.extra_teams IS 'Non-federated teams added by coordinators (e.g. Escoleta, Veterans).';

-- Coach favorite teams
-- Allows each coach user to save one or more linked teams (favorites)

CREATE TABLE IF NOT EXISTS public.coach_favorite_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_name text NOT NULL,
  team_name text NOT NULL,
  team_category text NOT NULL DEFAULT '',
  saved_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, club_name, team_name, team_category)
);

ALTER TABLE public.coach_favorite_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_favorite_teams_user_access ON public.coach_favorite_teams;
CREATE POLICY coach_favorite_teams_user_access ON public.coach_favorite_teams
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coach_favorite_teams_user_id
  ON public.coach_favorite_teams(user_id);

COMMENT ON TABLE public.coach_favorite_teams IS 'Coach linked teams/favorites per authenticated user';
COMMENT ON COLUMN public.coach_favorite_teams.team_category IS 'Category label/code shown in coach team chips';

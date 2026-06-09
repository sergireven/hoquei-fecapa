-- Coach selected club
-- Persists the active club selection for each authenticated coach user.

CREATE TABLE IF NOT EXISTS public.coach_selected_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_name text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.coach_selected_clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_selected_clubs_user_access ON public.coach_selected_clubs;
CREATE POLICY coach_selected_clubs_user_access ON public.coach_selected_clubs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coach_selected_clubs_user_id
  ON public.coach_selected_clubs(user_id);

COMMENT ON TABLE public.coach_selected_clubs IS 'Active club selection for each coach user';
COMMENT ON COLUMN public.coach_selected_clubs.club_name IS 'Display name of the selected coach club';
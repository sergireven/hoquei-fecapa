-- Coach tactic board states
-- Persist tactical board state per user/team so it survives logout/device changes.

CREATE TABLE IF NOT EXISTS public.coach_tactic_board_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  season text NOT NULL DEFAULT 'current',
  board_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, team_name, season)
);

ALTER TABLE public.coach_tactic_board_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_tactic_board_states_user_access ON public.coach_tactic_board_states;
CREATE POLICY coach_tactic_board_states_user_access ON public.coach_tactic_board_states
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coach_tactic_board_states_user_team
  ON public.coach_tactic_board_states(user_id, team_name, season);

COMMENT ON TABLE public.coach_tactic_board_states IS 'Saved tactical board state per coach and team';
COMMENT ON COLUMN public.coach_tactic_board_states.board_state IS 'JSON board model: players, puck, annotations, tool, ballMode, recording';
-- ═══════════════════════════════════════════════════════════════════════════
-- Coach Panel — Database Tables
-- Fase 1: training_plans, player_objectives
-- Fase 2: match_events
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. coach_training_plans ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_training_plans (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name        TEXT        NOT NULL DEFAULT '',
  season           TEXT        NOT NULL DEFAULT '2025-26',
  plan_date        DATE        NOT NULL,
  duration_minutes INTEGER     NOT NULL DEFAULT 90 CHECK (duration_minutes > 0),
  pillars          TEXT[]      NOT NULL DEFAULT '{}',
  focus_areas      TEXT[]               DEFAULT '{}',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_training_plans_user
  ON public.coach_training_plans (coach_user_id);
CREATE INDEX IF NOT EXISTS idx_coach_training_plans_team
  ON public.coach_training_plans (coach_user_id, team_name);
CREATE INDEX IF NOT EXISTS idx_coach_training_plans_date
  ON public.coach_training_plans (coach_user_id, plan_date);

ALTER TABLE public.coach_training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach: select own plans"
  ON public.coach_training_plans FOR SELECT
  USING (auth.uid() = coach_user_id);

CREATE POLICY "coach: insert own plans"
  ON public.coach_training_plans FOR INSERT
  WITH CHECK (auth.uid() = coach_user_id);

CREATE POLICY "coach: update own plans"
  ON public.coach_training_plans FOR UPDATE
  USING (auth.uid() = coach_user_id)
  WITH CHECK (auth.uid() = coach_user_id);

CREATE POLICY "coach: delete own plans"
  ON public.coach_training_plans FOR DELETE
  USING (auth.uid() = coach_user_id);

COMMENT ON TABLE  public.coach_training_plans IS 'Training sessions registered by coaches';
COMMENT ON COLUMN public.coach_training_plans.pillars     IS 'Selected training pillars: tecnica, tactica, fisic, mental, defensa, atac';
COMMENT ON COLUMN public.coach_training_plans.focus_areas IS 'Optional sub-areas within the chosen pillars';


-- ─── 2. coach_player_objectives ──────────────────────────────────────────
-- pillar_data JSON shape per player:
-- { "tecnica":  { "baseline": 4, "target": 7, "progress": 5 },
--   "tactica":  { "baseline": 3, "target": 6, "progress": 4 },
--   "fisic":    { ... }, "mental": { ... }, "defensa": { ... }, "atac": { ... } }
CREATE TABLE IF NOT EXISTS public.coach_player_objectives (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name     TEXT        NOT NULL DEFAULT '',
  player_name   TEXT        NOT NULL,
  season        TEXT        NOT NULL DEFAULT '2025-26',
  pillar_data   JSONB       NOT NULL DEFAULT '{}',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coach_user_id, team_name, player_name, season)
);

CREATE INDEX IF NOT EXISTS idx_coach_player_objectives_user
  ON public.coach_player_objectives (coach_user_id);
CREATE INDEX IF NOT EXISTS idx_coach_player_objectives_team
  ON public.coach_player_objectives (coach_user_id, team_name, season);

ALTER TABLE public.coach_player_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach: select own objectives"
  ON public.coach_player_objectives FOR SELECT
  USING (auth.uid() = coach_user_id);

CREATE POLICY "coach: insert own objectives"
  ON public.coach_player_objectives FOR INSERT
  WITH CHECK (auth.uid() = coach_user_id);

CREATE POLICY "coach: update own objectives"
  ON public.coach_player_objectives FOR UPDATE
  USING (auth.uid() = coach_user_id)
  WITH CHECK (auth.uid() = coach_user_id);

CREATE POLICY "coach: delete own objectives"
  ON public.coach_player_objectives FOR DELETE
  USING (auth.uid() = coach_user_id);

COMMENT ON TABLE  public.coach_player_objectives IS 'Per-player pillar objectives (baseline / target / progress) set by the coach';
COMMENT ON COLUMN public.coach_player_objectives.pillar_data IS 'JSON: { pillarId: { baseline, target, progress } } — values 0-10';


-- ─── 3. coach_match_events ────────────────────────────────────────────────
-- available_players JSON shape: [{name, isStarter, side:"D"|"E", pos:"DEF"|"MIG"|"DAV"|"PORT"}]
-- events JSON shape:            [{player, type, minute, ts}]
--   type values: goal | shot | assist | 1v1_won | 1v1_lost | ball_gain | ball_loss
CREATE TABLE IF NOT EXISTS public.coach_match_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name         TEXT        NOT NULL DEFAULT '',
  match_date        DATE        NOT NULL,
  opponent          TEXT        NOT NULL DEFAULT '',
  is_home           BOOLEAN     NOT NULL DEFAULT TRUE,
  available_players JSONB       NOT NULL DEFAULT '[]',
  events            JSONB       NOT NULL DEFAULT '[]',
  tactics           JSONB                DEFAULT '{}',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_match_events_user
  ON public.coach_match_events (coach_user_id);
CREATE INDEX IF NOT EXISTS idx_coach_match_events_team_date
  ON public.coach_match_events (coach_user_id, team_name, match_date);

ALTER TABLE public.coach_match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach: select own match events"
  ON public.coach_match_events FOR SELECT
  USING (auth.uid() = coach_user_id);

CREATE POLICY "coach: insert own match events"
  ON public.coach_match_events FOR INSERT
  WITH CHECK (auth.uid() = coach_user_id);

CREATE POLICY "coach: update own match events"
  ON public.coach_match_events FOR UPDATE
  USING (auth.uid() = coach_user_id)
  WITH CHECK (auth.uid() = coach_user_id);

CREATE POLICY "coach: delete own match events"
  ON public.coach_match_events FOR DELETE
  USING (auth.uid() = coach_user_id);

COMMENT ON TABLE  public.coach_match_events IS 'Real-time match event capture: lineups, in-game actions and post-match notes';
COMMENT ON COLUMN public.coach_match_events.events IS 'Array of {player, type, minute, ts} objects captured during the match';

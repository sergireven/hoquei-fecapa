-- ═══════════════════════════════════════════════════════════════════════════
-- Historical official matches/actes from JOK snapshots
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.matches_historical (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_acta_id    TEXT        NOT NULL,
  season            TEXT        NOT NULL,
  category          TEXT        NOT NULL,

  competition_id    UUID        REFERENCES public.competitions(id) ON DELETE SET NULL,
  competition_name  TEXT,

  jornada           INTEGER,
  match_date        DATE,
  match_time        TEXT,

  home_team_id      UUID        REFERENCES public.teams(id) ON DELETE SET NULL,
  away_team_id      UUID        REFERENCES public.teams(id) ON DELETE SET NULL,
  home_team_name    TEXT        NOT NULL,
  away_team_name    TEXT        NOT NULL,

  home_score        INTEGER,
  away_score        INTEGER,

  referees_json     TEXT,
  acta_url          TEXT,
  raw_json          TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (season, source_acta_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_hist_season       ON public.matches_historical (season);
CREATE INDEX IF NOT EXISTS idx_matches_hist_category     ON public.matches_historical (category);
CREATE INDEX IF NOT EXISTS idx_matches_hist_competition  ON public.matches_historical (competition_id);
CREATE INDEX IF NOT EXISTS idx_matches_hist_home_team    ON public.matches_historical (home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_hist_away_team    ON public.matches_historical (away_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_hist_date         ON public.matches_historical (match_date);

ALTER TABLE public.matches_historical ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_historical: public read" ON public.matches_historical;
DROP POLICY IF EXISTS "matches_historical: auth insert" ON public.matches_historical;
DROP POLICY IF EXISTS "matches_historical: auth update" ON public.matches_historical;

CREATE POLICY "matches_historical: public read"
  ON public.matches_historical FOR SELECT USING (TRUE);

CREATE POLICY "matches_historical: auth insert"
  ON public.matches_historical FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "matches_historical: auth update"
  ON public.matches_historical FOR UPDATE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.matches_historical IS 'Official historical match records (actes) imported from JOK snapshots.';
COMMENT ON COLUMN public.matches_historical.source_acta_id IS 'Original JOK acta id as text.';
COMMENT ON COLUMN public.matches_historical.referees_json IS 'JSON string array of referee names.';
COMMENT ON COLUMN public.matches_historical.raw_json IS 'Raw original acta payload as JSON string for recovery/debug.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Competicions i partits: schema extensible per tornejos i classifications
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. competitions ───────────────────────────────────────────────────────
-- One row per league/tournament/competition across all seasons.
-- Examples: "LNHP 2025-2026", "Copa del Rei", "Lliga Catàlana", etc.
CREATE TABLE IF NOT EXISTS public.competitions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,           -- e.g. "LNHP 2025-2026 - Aleví"
  competition_code  TEXT,                           -- e.g. "LNHP", "COPA", "LLIGA_CAT"
  category          TEXT        NOT NULL,           -- e.g. "Benjamí", "Juvenil"
  season            TEXT        NOT NULL,           -- e.g. "2025-26"
  competition_type  TEXT        NOT NULL DEFAULT 'league',  -- league | cup | friendly
  league_name       TEXT,                           -- e.g. "LNHP", "Divisió d'Honor"
  regional_level    TEXT,                           -- e.g. "estatal", "autonòmic", "local"
  
  -- Link to teams in this competition (optional denormalization)
  total_teams       INTEGER     NOT NULL DEFAULT 0,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (name, season, category)
);

CREATE INDEX IF NOT EXISTS idx_competitions_season     ON public.competitions (season);
CREATE INDEX IF NOT EXISTS idx_competitions_category   ON public.competitions (category);
CREATE INDEX IF NOT EXISTS idx_competitions_type       ON public.competitions (competition_type);
CREATE INDEX IF NOT EXISTS idx_competitions_code       ON public.competitions (competition_code);

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitions: public read"  ON public.competitions FOR SELECT USING (TRUE);
CREATE POLICY "competitions: auth insert"  ON public.competitions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "competitions: auth update"  ON public.competitions FOR UPDATE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE  public.competitions IS 'Leagues, tournaments, and competitions. One row per unique (name, season, category).';
COMMENT ON COLUMN public.competitions.name              IS 'Display name (e.g. "LNHP 2025-2026 - Aleví")';
COMMENT ON COLUMN public.competitions.competition_code  IS 'Shorthand code (e.g. "LNHP") for grouping across seasons';
COMMENT ON COLUMN public.competitions.competition_type  IS 'league | cup | friendly';
COMMENT ON COLUMN public.competitions.regional_level    IS 'estatal | autonòmic | local';


-- ─── 2. competition_teams ──────────────────────────────────────────────────
-- Junction table: links teams to competitions.
-- One row per (team, competition) pair so we know which teams play in which comps.
CREATE TABLE IF NOT EXISTS public.competition_teams (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    UUID        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  team_id           UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Team metadata within this specific competition
  team_seed         INTEGER,                        -- if applicable (tournament bracket)
  league_position   INTEGER,                        -- current standing (if league)
  matches_played    INTEGER     NOT NULL DEFAULT 0,
  wins              INTEGER     NOT NULL DEFAULT 0,
  draws             INTEGER     NOT NULL DEFAULT 0,
  losses            INTEGER     NOT NULL DEFAULT 0,
  points_for        INTEGER     NOT NULL DEFAULT 0,
  points_against    INTEGER     NOT NULL DEFAULT 0,
  
  joined_at         DATE,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (competition_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_comp_teams_competition ON public.competition_teams (competition_id);
CREATE INDEX IF NOT EXISTS idx_comp_teams_team       ON public.competition_teams (team_id);

ALTER TABLE public.competition_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_teams: public read"  ON public.competition_teams FOR SELECT USING (TRUE);
CREATE POLICY "comp_teams: auth insert"  ON public.competition_teams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "comp_teams: auth update"  ON public.competition_teams FOR UPDATE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE  public.competition_teams IS 'Junction: teams participating in competitions.';
COMMENT ON COLUMN public.competition_teams.team_seed         IS 'Tournament seed if applicable';
COMMENT ON COLUMN public.competition_teams.league_position   IS 'Current league standing (1st, 2nd, etc.)';


-- ─── 3. Trigger to update competitions.total_teams ────────────────────────
-- Automatically count how many teams are in each competition
CREATE OR REPLACE FUNCTION public.update_competition_team_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.competitions
  SET total_teams = (SELECT COUNT(*) FROM public.competition_teams WHERE competition_id = COALESCE(NEW.competition_id, OLD.competition_id))
  WHERE id = COALESCE(NEW.competition_id, OLD.competition_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_comp_team_count ON public.competition_teams;
CREATE TRIGGER trg_update_comp_team_count
  AFTER INSERT OR DELETE ON public.competition_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_competition_team_count();

-- ═══════════════════════════════════════════════════════════════════════════
-- Replace team_name with team_key in players table
-- team_key = "normalized_team::normalized_category::season" for consistent lookup
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add team_key column if missing
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team_key TEXT;

-- 2. Backfill team_key from teams table (join by team_name, season)
UPDATE public.players p
SET team_key = t.team_key
FROM public.teams t
WHERE p.team_key IS NULL 
  AND p.team_name IS NOT NULL
  AND p.season = t.season
  AND LOWER(REGEXP_REPLACE(p.team_name, '[^a-z0-9]+', '', 'g')) 
    = LOWER(REGEXP_REPLACE(t.team_name, '[^a-z0-9]+', '', 'g'));

-- 3. Drop old composite key constraint if it exists
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS "players_slug_team_name_season_key";

-- 4. Create new composite unique key with team_key instead of team_name
-- Note: This allows NULL team_key (for players without teams)
ALTER TABLE public.players
  ADD CONSTRAINT "players_slug_team_key_season_key" UNIQUE (slug, team_key, season);

-- 5. Create index for team_key lookups
CREATE INDEX IF NOT EXISTS idx_players_team_key ON public.players (team_key);

-- 6. Verify data population
SELECT 
  'Players with team_key' as metric, COUNT(*) as count 
FROM public.players 
WHERE team_key IS NOT NULL
UNION ALL
SELECT 'Players missing team_key', COUNT(*)
FROM public.players
WHERE team_key IS NULL
UNION ALL
SELECT 'Total players', COUNT(*)
FROM public.players;

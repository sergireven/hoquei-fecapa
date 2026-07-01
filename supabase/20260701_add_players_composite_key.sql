-- ═══════════════════════════════════════════════════════════════════════════
-- Add composite unique key to players table
-- Allows UPSERT by (slug, team_name, season) instead of just id
-- This ensures same player in same team/season gets updated, not duplicated
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add team_name column if missing (for composite key)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team_name TEXT;

-- 2. Add composite unique constraint
ALTER TABLE public.players
  ADD CONSTRAINT players_slug_team_season_unique
    UNIQUE (slug, team_name, season)
    ON CONFLICT DO NOTHING;

-- 3. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_players_slug_team_season
  ON public.players (slug, team_name, season);

-- Update existing NULL team_name values (if any)
UPDATE public.players p
SET team_name = t.team_name
FROM public.teams t
WHERE p.primary_team_id = t.id AND p.team_name IS NULL;

-- Backfill team_name from team_id for rows that may not have it
UPDATE public.players p
SET team_name = COALESCE(t.team_name, '')
FROM public.teams t
WHERE p.primary_team_id = t.id 
  AND (p.team_name IS NULL OR p.team_name = '');

COMMIT;

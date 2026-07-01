-- ═══════════════════════════════════════════════════════════════════════════
-- Add jok_id columns to clubs and teams for tracking jok.cat source IDs
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add jok_id to clubs table
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS jok_id TEXT;

-- 2. Create index on clubs.jok_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_clubs_jok_id ON public.clubs (jok_id);

-- 3. Add jok_id to teams table
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS jok_id TEXT;

-- 4. Create index on teams.jok_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_teams_jok_id ON public.teams (jok_id);

-- 5. Verify columns exist
SELECT 
  'clubs.jok_id' as table_column, COUNT(*) as total_rows, 
  COUNT(CASE WHEN jok_id IS NOT NULL THEN 1 END) as with_jok_id
FROM public.clubs
UNION ALL
SELECT 'teams.jok_id', COUNT(*), 
  COUNT(CASE WHEN jok_id IS NOT NULL THEN 1 END)
FROM public.teams;

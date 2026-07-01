-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: Clean up players table constraints and create optimal indexes for UPSERT
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Drop all problematic constraints and indexes on players
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS "players_slug_team_name_season_key";
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS "players_slug_team_key_season_key";

DROP INDEX IF EXISTS idx_players_team_key;
DROP INDEX IF EXISTS idx_players_team_name;
DROP INDEX IF EXISTS idx_players_jok_id_unique;

-- 2. Ensure team_key column exists
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team_key TEXT;

-- 3. Drop and recreate the UNIQUE composite key constraint for UPSERT
-- This is the PRIMARY lookup key for the UPSERT operation
ALTER TABLE public.players
  ADD CONSTRAINT "players_slug_team_key_season_key" UNIQUE (slug, team_key, season) 
    DEFERRABLE INITIALLY DEFERRED;

-- 4. Create supporting indexes for fast lookups (non-unique, for query performance)
CREATE INDEX IF NOT EXISTS idx_players_slug ON public.players (slug);
CREATE INDEX IF NOT EXISTS idx_players_team_key ON public.players (team_key);
CREATE INDEX IF NOT EXISTS idx_players_season ON public.players (season);
CREATE INDEX IF NOT EXISTS idx_players_jok_id ON public.players (jok_id);

-- 5. Ensure jok_id column exists (nullable, no UNIQUE constraint)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS jok_id TEXT;

-- 6. Verify structure
SELECT 
  'columns' as type,
  STRING_AGG(attname, ', ' ORDER BY attname) as details
FROM pg_attribute
WHERE attrelid = 'public.players'::regclass
  AND attnum > 0
  AND NOT attisdropped
UNION ALL
SELECT 'constraints',
  STRING_AGG(constraint_name, ', ')
FROM information_schema.table_constraints
WHERE table_name = 'players' AND table_schema = 'public'
UNION ALL
SELECT 'indexes',
  STRING_AGG(indexname, ', ')
FROM pg_indexes
WHERE tablename = 'players' AND schemaname = 'public';

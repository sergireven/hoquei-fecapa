-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: Remove strict UNIQUE constraint on jok_id and use partial unique index
-- PostgreSQL treats multiple NULLs as duplicates, breaking the sync
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Drop the incorrect UNIQUE constraint on jok_id if it exists
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_jok_id_key;

-- 2. Drop any incorrect indexes
DROP INDEX IF EXISTS idx_players_jok_id;

-- 3. Create PARTIAL unique index (only for non-NULL values)
-- This allows multiple NULLs while ensuring unique jok_id values
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_jok_id_unique 
  ON public.players (jok_id) 
  WHERE jok_id IS NOT NULL;

-- 4. Create regular index for fast lookups
CREATE INDEX IF NOT EXISTS idx_players_jok_id 
  ON public.players (jok_id);

-- 5. Verify
SELECT 
  'Total players' as metric, COUNT(*) as count FROM public.players
UNION ALL
SELECT 'Players with jok_id', COUNT(*) FROM public.players WHERE jok_id IS NOT NULL
UNION ALL
SELECT 'Players without jok_id', COUNT(*) FROM public.players WHERE jok_id IS NULL;

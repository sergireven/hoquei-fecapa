-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: Remove strict UNIQUE constraint on jok_id and use partial unique index
-- PostgreSQL treats multiple NULLs as duplicates, breaking the sync
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Drop the incorrect UNIQUE constraint on jok_id if it exists
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_jok_id_key;

-- 2. Drop any UNIQUE indexes on jok_id (jok_id can repeat across seasons)
DROP INDEX IF EXISTS idx_players_jok_id_unique;
DROP INDEX IF EXISTS idx_players_jok_id;

-- 3. Create NON-UNIQUE index for fast lookups only
-- jok_id CAN repeat (same jok.cat player across multiple seasons)
CREATE INDEX IF NOT EXISTS idx_players_jok_id 
  ON public.players (jok_id);

-- 5. Verify
SELECT 
  'Total players' as metric, COUNT(*) as count FROM public.players
UNION ALL
SELECT 'Players with jok_id', COUNT(*) FROM public.players WHERE jok_id IS NOT NULL
UNION ALL
SELECT 'Players without jok_id', COUNT(*) FROM public.players WHERE jok_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- Cleanup: Remove orphan masters (created with UUID fallback as master_key)
-- Add jok_id column to players table to store jok.cat player ID
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Delete orphan masters (those with master_key = UUID patterns, not normalized slug patterns)
-- These are masters created when a player had no slug/name and fell back to id
DELETE FROM public.player_masters
WHERE master_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}::'
  AND master_key !~ '^unknown-player';

-- 2. Add jok_id column to players table
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS jok_id TEXT UNIQUE;

-- 3. Create index on jok_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_players_jok_id ON public.players (jok_id);

-- 4. Verify cleanup: should show only 1 master for MARTÍ APARICIO CASAS now
SELECT 
  pm.canonical_name,
  pm.canonical_birth_date,
  pm.master_key,
  COUNT(DISTINCT p.id) as linked_players,
  STRING_AGG(DISTINCT p.season, ', ') as seasons
FROM public.player_masters pm
LEFT JOIN public.players p ON p.player_master_id = pm.id
WHERE pm.canonical_name LIKE '%MARTI%APARICIO%'
GROUP BY pm.id, pm.master_key, pm.canonical_name, pm.canonical_birth_date
ORDER BY COUNT(DISTINCT p.id) DESC;

-- 5. Final stats
SELECT 
  'Total players' as metric, COUNT(*) as count FROM public.players
UNION ALL
SELECT 'Players without master_id', COUNT(*) FROM public.players WHERE player_master_id IS NULL
UNION ALL
SELECT 'Unique masters', COUNT(*) FROM public.player_masters;

-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSIS: Find duplicate players and broken masters
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Find duplicate players (same slug, same season, but different team_key)
SELECT 
  slug,
  season,
  COUNT(*) as duplicates,
  STRING_AGG(DISTINCT team_key, ' | ') as team_keys,
  STRING_AGG(DISTINCT team_name, ' | ') as team_names
FROM public.players
GROUP BY slug, season
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;

-- 2. Count players with NULL team_key
SELECT 
  'Players with NULL team_key' as issue,
  COUNT(*) as count
FROM public.players
WHERE team_key IS NULL;

-- 3. Find MARTI APARICIO CASAS masters (should be 1, not 7)
SELECT 
  pm.canonical_name,
  pm.canonical_birth_date,
  COUNT(*) as master_count,
  STRING_AGG(pm.master_key, ' | ') as master_keys
FROM public.player_masters pm
WHERE pm.canonical_name LIKE '%MARTI%APARICIO%'
GROUP BY pm.canonical_name, pm.canonical_birth_date;

-- 4. Show all MARTI APARICIO CASAS players (expect 3 seasonal records)
SELECT 
  p.slug,
  p.season,
  p.team_key,
  p.team_name,
  p.player_master_id,
  pm.master_key
FROM public.players p
LEFT JOIN public.player_masters pm ON p.player_master_id = pm.id
WHERE p.slug LIKE '%MARTI%APARICIO%'
ORDER BY p.season, p.team_key;

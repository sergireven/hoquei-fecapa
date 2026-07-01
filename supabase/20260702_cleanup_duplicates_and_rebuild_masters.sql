-- ═══════════════════════════════════════════════════════════════════════════
-- CLEANUP: Remove duplicate players and rebuild masters from scratch
-- Strategy: Keep only records with valid team_key per (slug, season)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Identify records to DELETE (duplicates with NULL or invalid team_key)
-- For each (slug, season), rank by: team_key IS NOT NULL, then by id
WITH ranked_players AS (
  SELECT 
    id,
    slug,
    season,
    team_key,
    ROW_NUMBER() OVER (
      PARTITION BY slug, season 
      ORDER BY team_key IS NOT NULL DESC, id ASC
    ) as rn
  FROM public.players
)
DELETE FROM public.players
WHERE id IN (
  SELECT id FROM ranked_players WHERE rn > 1
);

-- 2. Delete ALL player_masters (will rebuild from clean players)
DELETE FROM public.player_masters;

-- 3. Rebuild player_masters with ONLY normalized slug + birth_date
-- This ensures 1 master per unique (normalized_slug, birth_date) combo
INSERT INTO public.player_masters (id, master_key, canonical_slug, canonical_name, canonical_birth_date)
SELECT 
  gen_random_uuid(),
  CONCAT(
    LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
    '::',
    COALESCE(TO_CHAR(birth_date, 'YYYYMMDD'), 'unknown')
  ),
  slug,
  UPPER(name),
  birth_date
FROM (
  SELECT DISTINCT ON (
    LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
    COALESCE(birth_date, '1900-01-01'::date)
  )
    slug,
    name,
    birth_date
  FROM public.players
  ORDER BY 
    LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
    COALESCE(birth_date, '1900-01-01'::date)
);

-- 4. Link ALL players to their masters
UPDATE public.players p
SET player_master_id = pm.id
FROM public.player_masters pm
WHERE pm.master_key = CONCAT(
  LOWER(REGEXP_REPLACE(unaccent(p.slug), '[^a-z0-9]+', '', 'g')),
  '::',
  COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown')
);

-- 5. Verification: Show final state
SELECT 
  'Total players' as metric,
  COUNT(*) as count
FROM public.players
UNION ALL
SELECT 'Total masters',
  COUNT(*)
FROM public.player_masters
UNION ALL
SELECT 'Players with master_id',
  COUNT(*)
FROM public.players
WHERE player_master_id IS NOT NULL
UNION ALL
SELECT 'Players without master_id',
  COUNT(*)
FROM public.players
WHERE player_master_id IS NULL
UNION ALL
SELECT 'MARTI APARICIO CASAS masters (should be 1)',
  COUNT(DISTINCT pm.id)
FROM public.player_masters pm
WHERE pm.canonical_name LIKE '%MARTI%APARICIO%';

-- 6. Show MARTI records
SELECT 
  p.slug,
  p.season,
  p.team_key,
  p.birth_date,
  pm.canonical_name,
  pm.master_key
FROM public.players p
LEFT JOIN public.player_masters pm ON p.player_master_id = pm.id
WHERE p.slug LIKE '%MARTI%APARICIO%'
ORDER BY p.season, p.team_key;

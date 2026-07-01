-- ═══════════════════════════════════════════════════════════════════════════
-- FULL CLEANUP: One comprehensive script to fix everything
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Delete duplicate players (keep only one per slug/season, preferring valid team_key)
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

-- STEP 2: Delete ALL player_masters (including orphans)
DELETE FROM public.player_masters;

-- STEP 3: Rebuild masters from clean players
-- Group by: normalized_slug + birth_date (2 identities for same person)
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

-- STEP 4: Link ALL players to masters
UPDATE public.players p
SET player_master_id = pm.id
FROM public.player_masters pm
WHERE pm.master_key = CONCAT(
  LOWER(REGEXP_REPLACE(unaccent(p.slug), '[^a-z0-9]+', '', 'g')),
  '::',
  COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown')
);

-- STEP 5: Verify results
SELECT 
  'Total players' as metric,
  COUNT(*) as count
FROM public.players
UNION ALL
SELECT 'Total masters',
  COUNT(*)
FROM public.player_masters
UNION ALL
SELECT 'Masters per player ratio (should be < 1)',
  ROUND(COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM public.players), 3)
FROM public.player_masters
UNION ALL
SELECT 'Players with master_id',
  COUNT(*)
FROM public.players
WHERE player_master_id IS NOT NULL
UNION ALL
SELECT 'MARTI APARICIO CASAS unique masters',
  COUNT(DISTINCT id)
FROM public.player_masters
WHERE canonical_name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'MARTI APARICIO CASAS players in DB',
  COUNT(*)
FROM public.players
WHERE slug LIKE '%MARTI%APARICIO%';

-- STEP 6: Show MARTI records in detail
SELECT 
  '=== MARTI APARICIO CASAS ===' as info
UNION ALL
SELECT 'Masters:'
UNION ALL
SELECT CONCAT('  - ', master_key)
FROM public.player_masters
WHERE canonical_name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'Players:'
UNION ALL
SELECT CONCAT(
  '  - Season: ', p.season, 
  ' | Team: ', COALESCE(p.team_key, 'NULL'),
  ' | BD: ', COALESCE(p.birth_date::text, 'NULL')
)
FROM public.players p
WHERE p.slug LIKE '%MARTI%APARICIO%'
ORDER BY 1, 2;

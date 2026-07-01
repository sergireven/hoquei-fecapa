-- ═══════════════════════════════════════════════════════════════════════════
-- FIX MASTER KEYS: Rebuild with CORRECT slugs (not player IDs)
-- Slugs are already correct, just need to rebuild master_keys
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Delete all player_masters (they have wrong master_keys with UUIDs)
DELETE FROM public.player_masters;

-- STEP 2: Rebuild masters with CORRECT master_keys using normalized slugs
INSERT INTO public.player_masters (id, master_key, canonical_slug, canonical_name, canonical_birth_date)
SELECT 
  gen_random_uuid(),
  CONCAT(
    LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
    '::',
    COALESCE(TO_CHAR(birth_date, 'YYYYMMDD'), 'unknown')
  ) as master_key,
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
  WHERE slug IS NOT NULL
  ORDER BY 
    LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
    COALESCE(birth_date, '1900-01-01'::date),
    slug,
    name
) AS distinct_identities;

-- STEP 3: Link all players to correct masters
UPDATE public.players p
SET player_master_id = pm.id
FROM public.player_masters pm
WHERE pm.master_key = CONCAT(
  LOWER(REGEXP_REPLACE(unaccent(p.slug), '[^a-z0-9]+', '', 'g')),
  '::',
  COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown')
);

-- STEP 4: Verify results
SELECT 'MARTI APARICIO CASAS masters (should be 1)' as metric, COUNT(DISTINCT id) as count 
FROM public.player_masters 
WHERE canonical_name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'MARTI APARICIO CASAS players (should be 3)', COUNT(*)
FROM public.players
WHERE name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'Total masters', COUNT(*)
FROM public.player_masters
UNION ALL
SELECT 'Total players', COUNT(*)
FROM public.players
UNION ALL
SELECT 'Players with master_id', COUNT(*)
FROM public.players
WHERE player_master_id IS NOT NULL;

-- STEP 5: Show MARTI master details
SELECT 
  'Master Key: ' || master_key as detail
FROM public.player_masters
WHERE canonical_name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT CONCAT('Player Season ', p.season, ': slug=', p.slug, ' | master_id=', p.player_master_id::text)
FROM public.players p
WHERE p.name LIKE '%MARTI%APARICIO%'
ORDER BY detail;

-- ═══════════════════════════════════════════════════════════════════════════
-- RESTORE SLUGS: Fix corrupted slugs (UUIDs) by reconstructing from name field
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Restore slugs from name field (replace UUIDs with normalized names)
UPDATE public.players
SET slug = UPPER(REPLACE(unaccent(name), ' ', '+'))
WHERE slug SIMILAR TO '[0-9a-f]{8}-[0-9a-f]{4}%';  -- Only update UUID-like slugs

-- STEP 2: Delete all player_masters (will rebuild with correct slugs)
DELETE FROM public.player_masters;

-- STEP 3: Rebuild masters with NOW-CORRECT slugs
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

-- STEP 4: Link players to masters
UPDATE public.players p
SET player_master_id = pm.id
FROM public.player_masters pm
WHERE pm.master_key = CONCAT(
  LOWER(REGEXP_REPLACE(unaccent(p.slug), '[^a-z0-9]+', '', 'g')),
  '::',
  COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown')
);

-- STEP 5: Verify MARTI
SELECT 
  'MARTI APARICIO CASAS masters' as metric,
  COUNT(DISTINCT id) as count
FROM public.player_masters
WHERE canonical_name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'MARTI players',
  COUNT(*)
FROM public.players
WHERE name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'Total masters',
  COUNT(*)
FROM public.player_masters
UNION ALL
SELECT 'Total players',
  COUNT(*)
FROM public.players;

-- STEP 6: Show MARTI details
SELECT 
  'Master Key: ' || master_key as detail
FROM public.player_masters
WHERE canonical_name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT CONCAT('Player: Season ', p.season, ' | Slug: ', p.slug, ' | Birth: ', COALESCE(p.birth_date::text, 'NULL'))
FROM public.players p
WHERE p.name LIKE '%MARTI%APARICIO%'
ORDER BY detail;

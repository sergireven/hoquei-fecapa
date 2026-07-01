-- ═══════════════════════════════════════════════════════════════════════════
-- AGGRESSIVE CLEANUP: Disable constraints, truncate, rebuild, re-enable
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Disable foreign key constraint temporarily
ALTER TABLE public.players DISABLE TRIGGER ALL;

-- STEP 2: Delete duplicate players (keep only one per slug/season)
WITH ranked_players AS (
  SELECT 
    id,
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

-- STEP 3: Re-enable trigger
ALTER TABLE public.players ENABLE TRIGGER ALL;

-- STEP 4: TRUNCATE player_masters (faster than DELETE, removes all rows + resets sequence)
TRUNCATE TABLE public.player_masters RESTART IDENTITY CASCADE;

-- STEP 5: Rebuild masters from scratch
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

-- STEP 6: Link all players to masters
UPDATE public.players p
SET player_master_id = pm.id
FROM public.player_masters pm
WHERE pm.master_key = CONCAT(
  LOWER(REGEXP_REPLACE(unaccent(p.slug), '[^a-z0-9]+', '', 'g')),
  '::',
  COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown')
);

-- STEP 7: Verify
SELECT 'metric' as col1, 'count' as col2
UNION ALL
SELECT 'Total players'::text, COUNT(*)::text FROM public.players
UNION ALL
SELECT 'Total masters'::text, COUNT(*)::text FROM public.player_masters
UNION ALL
SELECT 'MARTI APARICIO CASAS masters'::text, COUNT(DISTINCT id)::text 
FROM public.player_masters WHERE canonical_name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'MARTI players'::text, COUNT(*)::text 
FROM public.players WHERE slug LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'Players with master_id'::text, COUNT(*)::text 
FROM public.players WHERE player_master_id IS NOT NULL;

-- STEP 8: Show MARTI details
SELECT '--- MARTI APARICIO CASAS DETAILS ---' as info
UNION ALL
SELECT ''
UNION ALL
SELECT CONCAT('Master: ', master_key) as info
FROM public.player_masters
WHERE canonical_name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT ''
UNION ALL
SELECT CONCAT('Player - Season: ', p.season, ', Team: ', COALESCE(p.team_key, 'NULL'), ', Birth: ', COALESCE(p.birth_date::text, 'NULL'))
FROM public.players p
WHERE p.slug LIKE '%MARTI%APARICIO%'
ORDER BY info;

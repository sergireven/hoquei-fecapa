-- ═══════════════════════════════════════════════════════════════════════════
-- FINAL CLEANUP: Use DELETE (respects FK) instead of TRUNCATE
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Delete duplicate players (keep one per slug/season)
-- FK constraints are automatically respected - no orphans left
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

-- STEP 2: Delete ALL player_masters
DELETE FROM public.player_masters;

-- STEP 3: Rebuild masters from clean players data
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

-- STEP 4: Link all players to masters
UPDATE public.players p
SET player_master_id = pm.id
FROM public.player_masters pm
WHERE pm.master_key = CONCAT(
  LOWER(REGEXP_REPLACE(unaccent(p.slug), '[^a-z0-9]+', '', 'g')),
  '::',
  COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown')
);

-- STEP 5: Verify results
SELECT 'Total players' as metric, COUNT(*)::text as count FROM public.players
UNION ALL
SELECT 'Total masters', COUNT(*)::text FROM public.player_masters
UNION ALL
SELECT 'Masters per player ratio', ROUND((COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM public.players)), 2)::text 
FROM public.player_masters
UNION ALL
SELECT 'MARTI APARICIO CASAS masters (should be 1)', COUNT(DISTINCT id)::text 
FROM public.player_masters WHERE canonical_name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'MARTI players (should be 3)', COUNT(*)::text 
FROM public.players WHERE slug LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'Players with master_id', COUNT(*)::text 
FROM public.players WHERE player_master_id IS NOT NULL;

-- STEP 6: Show MARTI details
SELECT 'VERIFICATION: MARTI APARICIO CASAS' as detail
UNION ALL
SELECT CONCAT('  Master: ', master_key) FROM public.player_masters WHERE canonical_name LIKE '%MARTI%APARICIO%' LIMIT 1
UNION ALL
SELECT CONCAT('  Player 1 - Season: ', p.season, ', Team: ', COALESCE(p.team_key, 'NULL'), ', Birth: ', COALESCE(p.birth_date::text, 'NULL'))
FROM public.players p WHERE p.slug LIKE '%MARTI%APARICIO%' ORDER BY p.season LIMIT 1
UNION ALL
SELECT CONCAT('  Player 2 - Season: ', p.season, ', Team: ', COALESCE(p.team_key, 'NULL'), ', Birth: ', COALESCE(p.birth_date::text, 'NULL'))
FROM public.players p WHERE p.slug LIKE '%MARTI%APARICIO%' ORDER BY p.season LIMIT 1 OFFSET 1
UNION ALL
SELECT CONCAT('  Player 3 - Season: ', p.season, ', Team: ', COALESCE(p.team_key, 'NULL'), ', Birth: ', COALESCE(p.birth_date::text, 'NULL'))
FROM public.players p WHERE p.slug LIKE '%MARTI%APARICIO%' ORDER BY p.season LIMIT 1 OFFSET 2;

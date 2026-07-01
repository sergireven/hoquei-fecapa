-- ═══════════════════════════════════════════════════════════════════════════
-- SIMPLE: Consolidate player_masters by normalized slug + birth_date
-- One master_id per unique (normalized_slug, birth_date) combination
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Clear existing masters
DELETE FROM public.player_masters;
UPDATE public.players SET player_master_id = NULL;

-- 2. Create ONE master per unique (normalized_slug, birth_date)
-- Grouping: all players with same normalized name + same birthdate = SAME master
INSERT INTO public.player_masters (master_key, canonical_slug, canonical_name, canonical_birth_date)
SELECT 
  -- master_key: normalized slug + birth_date
  public.normalize_identity_token(p.slug) || '::' || COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown'),
  -- canonical_slug: the slug (already normalized from Node.js)
  p.slug,
  -- canonical_name: pick longest name (best display)
  (array_agg(p.name ORDER BY LENGTH(p.name) DESC))[1],
  -- canonical_birth_date: the birth_date
  p.birth_date
FROM public.players p
GROUP BY 
  public.normalize_identity_token(p.slug),
  p.birth_date
ON CONFLICT (master_key) DO NOTHING;

-- 3. Link all players to their master_id (simple join)
UPDATE public.players p
SET player_master_id = (
  SELECT pm.id
  FROM public.player_masters pm
  WHERE pm.master_key = public.normalize_identity_token(p.slug) || '::' || COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown')
);

-- 4. Verify: should have minimal masters, all players linked
SELECT 
  'Total players' as metric, COUNT(*) as count FROM public.players
UNION ALL
SELECT 'Players without master_id', COUNT(*) FROM public.players WHERE player_master_id IS NULL
UNION ALL
SELECT 'Unique masters', COUNT(*) FROM public.player_masters;

-- 5. Show sample consolidation (MARTÍ APARICIO CASAS)
SELECT 
  pm.canonical_name,
  pm.canonical_birth_date,
  COUNT(DISTINCT p.id) as player_records,
  STRING_AGG(DISTINCT p.season, ', ') as seasons
FROM public.player_masters pm
LEFT JOIN public.players p ON p.player_master_id = pm.id
WHERE pm.canonical_name LIKE '%MARTI%APARICIO%'
GROUP BY pm.id, pm.canonical_name, pm.canonical_birth_date
ORDER BY COUNT(DISTINCT p.id) DESC;

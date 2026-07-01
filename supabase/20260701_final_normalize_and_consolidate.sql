-- ═══════════════════════════════════════════════════════════════════════════
-- FINAL FIX: Normalize ALL player slugs (remove accents) then rebuild masters
-- This ensures old data with accents matches new data without accents
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Normalize all player slugs: remove accents from existing data
UPDATE public.players
SET slug = UPPER(unaccent(slug))
WHERE slug IS NOT NULL AND slug != '';

-- 2. Also normalize names (spaces instead of +)
UPDATE public.players
SET name = REPLACE(slug, '+', ' ')
WHERE name IS NOT NULL;

-- 3. Clear all masters to rebuild
DELETE FROM public.player_masters;
UPDATE public.players SET player_master_id = NULL;

-- 4. Rebuild masters: ONE per (normalized_slug, birth_date) group
INSERT INTO public.player_masters (master_key, canonical_slug, canonical_name, canonical_birth_date)
SELECT 
  -- master_key: stable identifier
  COALESCE(
    public.normalize_identity_token(p.slug),
    public.normalize_identity_token(p.name),
    'unknown-player'
  ) || '::' || COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown'),
  -- canonical values: pick longest representation
  (array_agg(p.slug ORDER BY LENGTH(p.slug) DESC))[1],
  (array_agg(p.name ORDER BY LENGTH(p.name) DESC))[1],
  p.birth_date
FROM public.players p
GROUP BY 
  COALESCE(
    public.normalize_identity_token(p.slug),
    public.normalize_identity_token(p.name),
    'unknown-player'
  ),
  p.birth_date
ON CONFLICT (master_key) DO NOTHING;

-- 5. Link all players to masters
UPDATE public.players p
SET player_master_id = (
  SELECT pm.id
  FROM public.player_masters pm
  WHERE pm.master_key = COALESCE(
    public.normalize_identity_token(p.slug),
    public.normalize_identity_token(p.name),
    'unknown-player'
  ) || '::' || COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown')
);

-- 6. VERIFY: Should be 1 master for MARTÍ APARICIO CASAS
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

-- 7. Final stats
SELECT 
  'Total players' as metric, COUNT(*) as count FROM public.players
UNION ALL
SELECT 'Players without master_id', COUNT(*) FROM public.players WHERE player_master_id IS NULL
UNION ALL
SELECT 'Unique masters', COUNT(*) FROM public.player_masters;

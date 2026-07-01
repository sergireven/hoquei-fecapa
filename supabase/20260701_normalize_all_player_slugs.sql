-- ═══════════════════════════════════════════════════════════════════════════
-- Recalculate player_master_ids for all existing players
-- Uses normalized (accent-free) version of slugs and names
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Delete all existing player_masters to start fresh
DELETE FROM public.player_masters;

-- 2. Reset all player_master_ids to NULL
UPDATE public.players SET player_master_id = NULL;

-- 3. Rebuild player_masters by inserting normalized identity keys
WITH normalized_identities AS (
  SELECT 
    p.id,
    p.slug,
    p.name,
    p.birth_date,
    public.build_player_master_key(p.slug, p.name, p.birth_date, p.id::TEXT) AS master_key
  FROM public.players p
),
unique_masters AS (
  SELECT DISTINCT
    master_key,
    (array_agg(slug ORDER BY LENGTH(slug) DESC NULLS LAST))[1] as canonical_slug,
    (array_agg(name ORDER BY LENGTH(name) DESC NULLS LAST))[1] as canonical_name,
    MIN(birth_date) as canonical_birth_date
  FROM normalized_identities
  GROUP BY master_key
)
INSERT INTO public.player_masters (master_key, canonical_slug, canonical_name, canonical_birth_date)
SELECT * FROM unique_masters;

-- 4. Link all players to their master_ids
WITH player_masters_map AS (
  SELECT 
    p.id as player_id,
    public.build_player_master_key(p.slug, p.name, p.birth_date, p.id::TEXT) as master_key
  FROM public.players p
)
UPDATE public.players p
SET player_master_id = pm.id
FROM player_masters_map pmm
JOIN public.player_masters pm ON pm.master_key = pmm.master_key
WHERE p.id = pmm.player_id;

-- 5. Verify results
SELECT 
  COUNT(*) as total_players,
  COUNT(CASE WHEN player_master_id IS NULL THEN 1 END) as without_master_id,
  COUNT(DISTINCT player_master_id) as unique_masters
FROM public.players;

-- 6. Check for remaining duplicates (should be minimal or zero)
WITH master_summary AS (
  SELECT 
    pm.id,
    pm.canonical_name,
    public.normalize_identity_token(pm.canonical_name) as normalized_name,
    COUNT(DISTINCT p.id) as linked_players
  FROM public.player_masters pm
  LEFT JOIN public.players p ON p.player_master_id = pm.id
  GROUP BY pm.id, pm.canonical_name
)
SELECT 
  normalized_name,
  COUNT(*) as master_variants,
  SUM(linked_players) as total_linked_players,
  STRING_AGG(DISTINCT canonical_name, ' | ') as name_variants
FROM master_summary
GROUP BY normalized_name
HAVING COUNT(*) > 1
ORDER BY master_variants DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- Consolidate duplicate player_masters and rebuild all relationships
-- For players with same canonical identity (after normalization), keep only ONE master
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create temp table with normalized identity and primary master to keep
WITH normalized_players AS (
  SELECT
    pm.id,
    pm.master_key,
    pm.canonical_slug,
    pm.canonical_name,
    pm.canonical_birth_date,
    -- Normalize: remove accents, lowercase, alphanumeric only
    public.normalize_identity_token(pm.canonical_slug) AS normalized_slug,
    public.normalize_identity_token(pm.canonical_name) AS normalized_name,
    ROW_NUMBER() OVER (
      PARTITION BY 
        public.normalize_identity_token(pm.canonical_slug),
        public.normalize_identity_token(pm.canonical_name),
        pm.canonical_birth_date
      ORDER BY pm.created_at ASC
    ) AS rn
  FROM public.player_masters pm
),
primary_masters AS (
  SELECT * FROM normalized_players WHERE rn = 1
),
duplicate_masters AS (
  SELECT * FROM normalized_players WHERE rn > 1
)

-- 2. Merge players from duplicate masters into primary masters
-- Update player_master_id for all players linked to duplicate masters
UPDATE public.players p
SET player_master_id = pm_primary.id
FROM duplicate_masters dm
JOIN primary_masters pm_primary 
  ON public.normalize_identity_token(pm_primary.canonical_slug) = dm.normalized_slug
  AND public.normalize_identity_token(pm_primary.canonical_name) = dm.normalized_name
  AND pm_primary.canonical_birth_date IS NOT DISTINCT FROM dm.canonical_birth_date
WHERE p.player_master_id = dm.id;

-- 3. Delete duplicate masters (those not primary)
DELETE FROM public.player_masters pm
WHERE pm.id IN (
  SELECT dm.id FROM normalized_players dm WHERE dm.rn > 1
);

-- 4. Verify consolidation
SELECT 
  COUNT(*) AS unique_master_count,
  SUM(player_count) AS total_player_links
FROM (
  SELECT 
    pm.id,
    pm.canonical_name,
    COUNT(DISTINCT p.id) AS player_count
  FROM public.player_masters pm
  LEFT JOIN public.players p ON p.player_master_id = pm.id
  GROUP BY pm.id, pm.canonical_name
) grouped;

-- 5. Report potential duplicates by normalized name
SELECT 
  public.normalize_identity_token(pm.canonical_slug) AS normalized_slug,
  public.normalize_identity_token(pm.canonical_name) AS normalized_name,
  pm.canonical_birth_date,
  COUNT(*) AS duplicate_count,
  STRING_AGG(DISTINCT pm.canonical_name, ' | ') AS name_variants,
  COUNT(DISTINCT p.id) AS total_player_links
FROM public.player_masters pm
LEFT JOIN public.players p ON p.player_master_id = pm.id
GROUP BY 
  public.normalize_identity_token(pm.canonical_slug),
  public.normalize_identity_token(pm.canonical_name),
  pm.canonical_birth_date
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

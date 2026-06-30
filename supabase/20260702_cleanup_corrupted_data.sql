-- ═══════════════════════════════════════════════════════════════════════════
-- URGENT FIX: Clean up corrupted canonical_names and deduplicate player_masters
-- Handles:
-- 1. Canonical names with + symbols (should be spaces)
-- 2. Missing player_masters for existing players
-- 3. Duplicate player_masters with same canonical_name but different master_keys
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Fix canonical_names that still have + symbols
UPDATE public.player_masters
SET
  canonical_name = REPLACE(canonical_name, '+', ' '),
  updated_at = NOW()
WHERE canonical_name LIKE '%+%';

-- Step 2: Create missing player_masters entries for orphaned players
WITH orphaned_players AS (
  SELECT
    p.id,
    p.name,
    p.slug,
    p.birth_date,
    p.season,
    public.build_player_master_key(p.slug, p.name, p.birth_date, p.id::TEXT) AS master_key
  FROM public.players p
  WHERE p.player_master_id IS NULL
)
INSERT INTO public.player_masters (master_key, canonical_slug, canonical_name, canonical_birth_date)
SELECT DISTINCT
  op.master_key,
  NULLIF(BTRIM(op.slug), ''),
  COALESCE(NULLIF(BTRIM(op.name), ''), 'Jugador sense nom'),
  op.birth_date
FROM orphaned_players op
ON CONFLICT (master_key) DO UPDATE
SET
  canonical_slug = COALESCE(public.player_masters.canonical_slug, EXCLUDED.canonical_slug),
  canonical_name = CASE
    WHEN COALESCE(array_length(regexp_split_to_array(EXCLUDED.canonical_name, '\\s+'), 1), 0) >
         COALESCE(array_length(regexp_split_to_array(public.player_masters.canonical_name, '\\s+'), 1), 0)
      THEN EXCLUDED.canonical_name
    ELSE public.player_masters.canonical_name
  END,
  canonical_birth_date = COALESCE(public.player_masters.canonical_birth_date, EXCLUDED.canonical_birth_date),
  updated_at = NOW();

-- Step 3: Link orphaned players to their newly created/updated masters
WITH orphaned_players AS (
  SELECT
    p.id,
    public.build_player_master_key(p.slug, p.name, p.birth_date, p.id::TEXT) AS master_key
  FROM public.players p
  WHERE p.player_master_id IS NULL
)
UPDATE public.players p
SET player_master_id = pm.id
FROM orphaned_players op
JOIN public.player_masters pm ON pm.master_key = op.master_key
WHERE p.id = op.id
  AND p.player_master_id IS NULL;

-- Step 4: Consolidate duplicate player_masters with identical canonical_name+birth_date
-- This handles case where "MATEU APARICIO CASAS" exists with multiple master_keys
WITH duplicates AS (
  SELECT
    canonical_name,
    canonical_birth_date,
    ARRAY_AGG(id ORDER BY id) AS all_ids,
    (ARRAY_AGG(id ORDER BY id))[1] AS keep_id,
    COUNT(*) AS duplicate_count
  FROM public.player_masters
  GROUP BY canonical_name, canonical_birth_date
  HAVING COUNT(*) > 1
)
UPDATE public.players p
SET player_master_id = d.keep_id
FROM duplicates d,
     unnest(d.all_ids) AS dup_id
WHERE p.player_master_id = dup_id
  AND dup_id != d.keep_id;

-- Delete obsolete master records (keep only the minimum ID)
WITH duplicates AS (
  SELECT
    canonical_name,
    canonical_birth_date,
    ARRAY_AGG(id ORDER BY id) AS all_ids,
    (ARRAY_AGG(id ORDER BY id))[1] AS keep_id,
    COUNT(*) AS duplicate_count
  FROM public.player_masters
  GROUP BY canonical_name, canonical_birth_date
  HAVING COUNT(*) > 1
)
DELETE FROM public.player_masters
WHERE id IN (
  SELECT dup_id
  FROM duplicates d,
       unnest(d.all_ids[2:]) AS dup_id
);

COMMENT ON SCHEMA public IS 'Sync completed with fixes: canonical_names cleaned, orphaned players linked, duplicates consolidated.';

-- ═══════════════════════════════════════════════════════════════════════════
-- EMERGENCY CLEANUP: Fix URL encoding and deduplicate players/player_masters
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Decode URL-encoded names and slugs in players table
-- %C3%91 → Ñ, %C3%A9 → é, etc.
UPDATE public.players
SET
  name = CASE
    WHEN name LIKE '%\%%' THEN
      -- Try to decode if it looks URL-encoded
      CASE
        WHEN name LIKE '%C3%' THEN
          -- European character encoding
          REGEXP_REPLACE(name, E'%([0-9A-Fa-f]{2})', E'\\\\x\\1', 'g')
        ELSE name
      END
    ELSE name
  END,
  slug = CASE
    WHEN slug LIKE '%\%%' THEN
      -- Decode URL-encoded slug
      CASE
        WHEN slug LIKE '%C3%' THEN
          REGEXP_REPLACE(slug, E'%([0-9A-Fa-f]{2})', E'\\\\x\\1', 'g')
        ELSE slug
      END
    ELSE slug
  END
WHERE name LIKE '%\%%' OR slug LIKE '%\%%';

-- Step 2: Replace + with spaces in slug
UPDATE public.players
SET slug = REPLACE(slug, '+', ' ')
WHERE slug LIKE '%+%';

-- Step 3: Trim whitespace
UPDATE public.players
SET
  name = TRIM(name),
  slug = TRIM(slug)
WHERE name != TRIM(name) OR slug != TRIM(slug);

-- Step 4: Remove NULL player_master_id entries and re-link them
-- First, recreate master entries for orphaned players
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

-- Link orphaned players to masters
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

-- Step 5: Consolidate duplicate player_masters (same canonical_name + birth_date)
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

-- Delete duplicate master records
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

-- Step 6: Fix canonical_names with + symbols or URL encoding
UPDATE public.player_masters
SET
  canonical_name = REPLACE(TRIM(canonical_name), '+', ' '),
  canonical_slug = REPLACE(TRIM(COALESCE(canonical_slug, '')), '+', ' '),
  updated_at = NOW()
WHERE canonical_name LIKE '%+%' 
   OR canonical_name LIKE '%\%%'
   OR canonical_slug LIKE '%+%'
   OR canonical_slug LIKE '%\%%';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run these to check results)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Check for URL-encoded characters still present
SELECT COUNT(*) as url_encoded_names FROM public.players WHERE name LIKE '%\%%';
SELECT COUNT(*) as url_encoded_slugs FROM public.players WHERE slug LIKE '%\%%';

-- 2. Check for + characters still present
SELECT COUNT(*) as names_with_plus FROM public.players WHERE name LIKE '%+%';
SELECT COUNT(*) as slugs_with_plus FROM public.players WHERE slug LIKE '%+%';

-- 3. Check for NULL player_master_id
SELECT COUNT(*) as orphaned_players FROM public.players WHERE player_master_id IS NULL;

-- 4. Check for duplicates in player_masters
SELECT canonical_name, canonical_birth_date, COUNT(*) as duplicate_count
FROM public.player_masters
GROUP BY canonical_name, canonical_birth_date
HAVING COUNT(*) > 1;

-- 5. Check for + or % in canonical_names
SELECT COUNT(*) as bad_names FROM public.player_masters WHERE canonical_name LIKE '%+%' OR canonical_name LIKE '%\%%';

-- 6. Sample of cleaned data
SELECT p.id, p.name, p.slug, pm.canonical_name 
FROM public.players p
LEFT JOIN public.player_masters pm ON pm.id = p.player_master_id
LIMIT 10;

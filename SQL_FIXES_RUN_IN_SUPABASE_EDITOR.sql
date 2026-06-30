-- ═══════════════════════════════════════════════════════════════════════════
-- EXECUTE THESE IN SUPABASE SQL EDITOR BEFORE RUNNING SYNC
-- Consolidates all migration fixes in one script for easy execution
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Recalculate canonical_names using best_player_display_name logic
WITH prepared AS (
  SELECT
    pm.id,
    pm.master_key,
    ARRAY_AGG(DISTINCT public.best_player_display_name(p.name, p.slug) ORDER BY public.best_player_display_name(p.name, p.slug)) AS name_candidates
  FROM public.player_masters pm
  LEFT JOIN public.players p ON p.player_master_id = pm.id
  GROUP BY pm.id, pm.master_key
),
best_names AS (
  SELECT
    id,
    (
      ARRAY_AGG(candidate
        ORDER BY
          COALESCE(array_length(regexp_split_to_array(candidate, '\\s+'), 1), 0) DESC,
          LENGTH(candidate) DESC,
          candidate ASC
      ) FILTER (WHERE candidate IS NOT NULL)
    )[1] AS best_name
  FROM (
    SELECT p.id, UNNEST(p.name_candidates) AS candidate
    FROM prepared p
  ) AS candidates
  GROUP BY id
)
UPDATE public.player_masters pm
SET
  canonical_name = bn.best_name,
  updated_at = NOW()
FROM best_names bn
WHERE pm.id = bn.id
  AND pm.canonical_name IS DISTINCT FROM bn.best_name;

-- Step 2: Fix canonical_names that still have + symbols
UPDATE public.player_masters
SET
  canonical_name = REPLACE(canonical_name, '+', ' '),
  updated_at = NOW()
WHERE canonical_name LIKE '%+%';

-- Step 3: Update trigger to recalculate master_key when slug/name/birth_date change
CREATE OR REPLACE FUNCTION public.ensure_player_master_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_master_key TEXT;
  v_new_master_key TEXT;
  v_master_id UUID;
BEGIN
  v_new_master_key := public.build_player_master_key(NEW.slug, NEW.name, NEW.birth_date, NEW.id::TEXT);

  IF TG_OP = 'UPDATE' AND NEW.player_master_id IS NOT NULL THEN
    v_old_master_key := public.build_player_master_key(OLD.slug, OLD.name, OLD.birth_date, OLD.id::TEXT);
    IF v_old_master_key = v_new_master_key THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.player_masters (master_key, canonical_slug, canonical_name, canonical_birth_date)
  VALUES (
    v_new_master_key,
    NULLIF(BTRIM(NEW.slug), ''),
    COALESCE(NULLIF(BTRIM(NEW.name), ''), 'Jugador sense nom'),
    NEW.birth_date
  )
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
    updated_at = NOW()
  RETURNING id INTO v_master_id;

  NEW.player_master_id := v_master_id;
  RETURN NEW;
END;
$$;

-- Step 4: Create missing player_masters entries for orphaned players
WITH orphaned_players AS (
  SELECT
    p.id,
    p.name,
    p.slug,
    p.birth_date,
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

-- Step 5: Link orphaned players to their newly created/updated masters
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

-- Step 6: Consolidate duplicate player_masters with identical canonical_name+birth_date
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

DELETE FROM public.player_masters
WHERE id IN (
  SELECT dup_id
  FROM (
    SELECT
      ARRAY_AGG(id ORDER BY id) AS all_ids,
      (ARRAY_AGG(id ORDER BY id))[1] AS keep_id,
      COUNT(*) AS duplicate_count
    FROM public.player_masters
    GROUP BY canonical_name, canonical_birth_date
    HAVING COUNT(*) > 1
  ) duplicates,
  unnest(duplicates.all_ids[2:]) AS dup_id
);

-- Verification queries (run these AFTER all updates to verify correctness):
-- SELECT COUNT(*) FROM public.player_masters WHERE canonical_name LIKE '%+%';  -- Should be 0
-- SELECT canonical_name, COUNT(*) FROM public.player_masters GROUP BY canonical_name HAVING COUNT(*) > 1;  -- Should be empty
-- SELECT COUNT(*) FROM public.players WHERE player_master_id IS NULL;  -- Should be 0

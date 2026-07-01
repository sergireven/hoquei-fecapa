-- ═══════════════════════════════════════════════════════════════════════════
-- Fix trigger to use CORRECTED build_player_master_key logic
-- Ensures NEW inserts also avoid prefix-empty masters
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ensure_player_master_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_master_key TEXT;
  v_new_master_key TEXT;
  v_master_id UUID;
BEGIN
  -- Always compute the new master key based on current slug, name, birth_date
  -- FIXED: Never pass player.id, always pass empty string ''
  v_new_master_key := public.build_player_master_key(NEW.slug, NEW.name, NEW.birth_date, '');

  -- If this is an update and identity hasn't changed, and master_id already exists, skip
  IF TG_OP = 'UPDATE' AND NEW.player_master_id IS NOT NULL THEN
    v_old_master_key := public.build_player_master_key(OLD.slug, OLD.name, OLD.birth_date, '');
    IF v_old_master_key = v_new_master_key THEN
      RETURN NEW;  -- Identity unchanged, keep existing master_id
    END IF;
  END IF;

  -- Identity is new or changed: insert/update master record and link it
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

COMMENT ON FUNCTION public.ensure_player_master_id IS 'Automatically assigns or updates player_master_id. Recalculates master_key whenever slug, name, or birth_date change. FIXED: Never uses player.id as fallback.';

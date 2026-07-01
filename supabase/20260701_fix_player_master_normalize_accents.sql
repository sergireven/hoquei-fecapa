-- ═══════════════════════════════════════════════════════════════════════════
-- Fix player master deduplication: normalize accents and special characters
-- Activates unaccent extension and improves master_key normalization
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Activar extensió unaccent (elimina accents)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Millorar la funció de normalització: accents FIRST, després REGEXP_REPLACE
CREATE OR REPLACE FUNCTION public.normalize_identity_token(raw_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    LOWER(
      REGEXP_REPLACE(
        unaccent(COALESCE(raw_value, '')),
        '[^a-z0-9]+',
        '',
        'g'
      )
    ),
    ''
  );
$$;

-- 3. Actualitzar build_player_master_key per usar la nova normalització
CREATE OR REPLACE FUNCTION public.build_player_master_key(
  in_slug TEXT,
  in_name TEXT,
  in_birth_date DATE,
  in_fallback TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_slug_key TEXT;
  v_name_key TEXT;
  v_base_key TEXT;
BEGIN
  v_slug_key := public.normalize_identity_token(in_slug);
  v_name_key := public.normalize_identity_token(in_name);
  v_base_key := COALESCE(v_slug_key, v_name_key, NULLIF(BTRIM(COALESCE(in_fallback, '')), ''), 'unknown-player');

  IF in_birth_date IS NOT NULL THEN
    RETURN v_base_key || '::' || TO_CHAR(in_birth_date, 'YYYYMMDD');
  END IF;

  RETURN v_base_key;
END;
$$;

-- 4. Actualitzar ensure_player_master_id trigger per usar la nova normalització
CREATE OR REPLACE FUNCTION public.ensure_player_master_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_master_key TEXT;
  v_master_id UUID;
BEGIN
  IF NEW.player_master_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Build master_key: normalize slug/name with accents removed, optionally add birth_date
  v_master_key := public.build_player_master_key(NEW.slug, NEW.name, NEW.birth_date, NEW.id::TEXT);

  INSERT INTO public.player_masters (master_key, canonical_slug, canonical_name, canonical_birth_date)
  VALUES (
    v_master_key,
    NULLIF(BTRIM(NEW.slug), ''),
    COALESCE(NULLIF(BTRIM(NEW.name), ''), 'Jugador sense nom'),
    NEW.birth_date
  )
  ON CONFLICT (master_key) DO UPDATE
  SET
    canonical_slug = COALESCE(public.player_masters.canonical_slug, EXCLUDED.canonical_slug),
    canonical_name = COALESCE(NULLIF(public.player_masters.canonical_name, ''), EXCLUDED.canonical_name),
    canonical_birth_date = COALESCE(public.player_masters.canonical_birth_date, EXCLUDED.canonical_birth_date),
    updated_at = NOW()
  RETURNING id INTO v_master_id;

  NEW.player_master_id := v_master_id;
  RETURN NEW;
END;
$$;

-- 5. Recalculate all existing players to link to correct master_id with NEW logic
WITH prepared AS (
  SELECT
    p.id AS player_id,
    p.slug,
    p.name,
    p.birth_date,
    public.build_player_master_key(p.slug, p.name, p.birth_date, p.id::TEXT) AS master_key
  FROM public.players p
)
UPDATE public.players p
SET player_master_id = pm.id
FROM prepared pr
JOIN public.player_masters pm ON pm.master_key = pr.master_key
WHERE p.id = pr.player_id;

-- 6. Ensure all players have a master_id (create missing masters if needed)
WITH missing_players AS (
  SELECT
    p.id,
    p.slug,
    p.name,
    p.birth_date,
    public.build_player_master_key(p.slug, p.name, p.birth_date, p.id::TEXT) AS master_key
  FROM public.players p
  WHERE p.player_master_id IS NULL
),
create_masters AS (
  INSERT INTO public.player_masters (master_key, canonical_slug, canonical_name, canonical_birth_date)
  SELECT DISTINCT
    mp.master_key,
    mp.slug,
    COALESCE(NULLIF(BTRIM(mp.name), ''), 'Jugador sense nom'),
    mp.birth_date
  FROM missing_players mp
  ON CONFLICT (master_key) DO UPDATE SET
    canonical_birth_date = COALESCE(public.player_masters.canonical_birth_date, EXCLUDED.canonical_birth_date)
  RETURNING master_key, id
)
UPDATE public.players p
SET player_master_id = cm.id
FROM create_masters cm
JOIN missing_players mp ON mp.master_key = cm.master_key
WHERE p.id = mp.id;

-- Verify result
SELECT 
  COUNT(DISTINCT player_master_id) AS unique_master_ids,
  COUNT(*) AS total_players
FROM public.players
WHERE name LIKE '%MART%APARICIO%';

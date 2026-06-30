-- ═══════════════════════════════════════════════════════════════════════════
-- Complementary deduplication refinement for player masters
-- Uses slug + birth_date (when available) to reduce false positives on same name
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE public.player_masters
  ADD COLUMN IF NOT EXISTS canonical_birth_date DATE;

CREATE OR REPLACE FUNCTION public.normalize_identity_token(raw_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    LOWER(REGEXP_REPLACE(COALESCE(raw_value, ''), '[^a-z0-9]+', '', 'g')),
    ''
  );
$$;

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

CREATE OR REPLACE FUNCTION public.best_player_display_name(
  in_name TEXT,
  in_slug TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_name TEXT;
  v_slug_name TEXT;
  v_name_tokens INT;
  v_slug_tokens INT;
BEGIN
  v_name := NULLIF(BTRIM(COALESCE(in_name, '')), '');
  v_slug_name := NULLIF(BTRIM(REPLACE(COALESCE(in_slug, ''), '+', ' ')), '');

  IF v_name IS NULL AND v_slug_name IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_name IS NULL THEN
    RETURN v_slug_name;
  END IF;
  IF v_slug_name IS NULL THEN
    RETURN v_name;
  END IF;

  v_name_tokens := COALESCE(array_length(regexp_split_to_array(v_name, '\\s+'), 1), 0);
  v_slug_tokens := COALESCE(array_length(regexp_split_to_array(v_slug_name, '\\s+'), 1), 0);

  IF v_name_tokens > v_slug_tokens THEN
    RETURN v_name;
  END IF;
  IF v_slug_tokens > v_name_tokens THEN
    RETURN v_slug_name;
  END IF;

  IF LENGTH(v_name) >= LENGTH(v_slug_name) THEN
    RETURN v_name;
  END IF;
  RETURN v_slug_name;
END;
$$;

WITH prepared AS (
  SELECT
    p.id AS player_id,
    p.slug,
    p.name,
    p.birth_date,
    public.build_player_master_key(p.slug, p.name, p.birth_date, p.id::TEXT) AS master_key
  FROM public.players p
),
masters AS (
  SELECT
    master_key,
    MIN(NULLIF(BTRIM(slug), '')) FILTER (WHERE NULLIF(BTRIM(slug), '') IS NOT NULL) AS canonical_slug,
    (
      ARRAY_AGG(public.best_player_display_name(name, slug)
        ORDER BY
          COALESCE(array_length(regexp_split_to_array(public.best_player_display_name(name, slug), '\\s+'), 1), 0) DESC,
          LENGTH(public.best_player_display_name(name, slug)) DESC,
          public.best_player_display_name(name, slug) ASC
      ) FILTER (WHERE public.best_player_display_name(name, slug) IS NOT NULL)
    )[1] AS canonical_name,
    MIN(birth_date) FILTER (WHERE birth_date IS NOT NULL) AS canonical_birth_date
  FROM prepared
  GROUP BY master_key
)
INSERT INTO public.player_masters (master_key, canonical_slug, canonical_name, canonical_birth_date)
SELECT
  m.master_key,
  m.canonical_slug,
  COALESCE(m.canonical_name, 'Jugador sense nom'),
  m.canonical_birth_date
FROM masters m
ON CONFLICT (master_key) DO UPDATE
SET
  canonical_slug = COALESCE(public.player_masters.canonical_slug, EXCLUDED.canonical_slug),
  canonical_name = COALESCE(NULLIF(public.player_masters.canonical_name, ''), EXCLUDED.canonical_name),
  canonical_birth_date = COALESCE(public.player_masters.canonical_birth_date, EXCLUDED.canonical_birth_date),
  updated_at = NOW();

WITH prepared AS (
  SELECT
    p.id AS player_id,
    public.build_player_master_key(p.slug, p.name, p.birth_date, p.id::TEXT) AS master_key
  FROM public.players p
)
UPDATE public.players p
SET player_master_id = pm.id
FROM prepared pr
JOIN public.player_masters pm ON pm.master_key = pr.master_key
WHERE p.id = pr.player_id
  AND (p.player_master_id IS DISTINCT FROM pm.id);

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

DROP TRIGGER IF EXISTS trg_players_ensure_master_id ON public.players;

CREATE TRIGGER trg_players_ensure_master_id
BEFORE INSERT OR UPDATE OF slug, name, birth_date, player_master_id
ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.ensure_player_master_id();

COMMENT ON COLUMN public.players.birth_date IS 'Player birth date when available; improves global identity deduplication.';
COMMENT ON COLUMN public.player_masters.canonical_birth_date IS 'Best known birth date for the global player identity.';

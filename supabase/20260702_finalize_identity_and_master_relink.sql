-- ============================================================================
-- Final hardening for player/team identity and player master linking
-- Covers MARTI-like cases in a generic, idempotent way.
--
-- What this script enforces:
-- 1) build_player_master_key uses NAME-first normalization (avoids URL-encoded slug issues)
-- 2) player masters are rebuilt from normalized name + birth_date and players are relinked
-- 3) missing teams referenced by players.team_key (4-part) are created automatically
-- 4) players are relinked to teams by canonical team_key
-- ============================================================================

BEGIN;

-- 0) Ensure extension exists for accent-insensitive normalization
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1) Robust normalization helper: LOWER(unaccent()) BEFORE regex
CREATE OR REPLACE FUNCTION public.normalize_identity_token(raw_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    REGEXP_REPLACE(
      LOWER(unaccent(COALESCE(raw_value, ''))),
      '[^a-z0-9]+',
      '',
      'g'
    ),
    ''
  );
$$;

-- 2) Master key builder: prefer NAME over SLUG to avoid URL-encoded slug artifacts
CREATE OR REPLACE FUNCTION public.build_player_master_key(
  in_slug TEXT,
  in_name TEXT,
  in_birth_date DATE,
  in_fallback TEXT DEFAULT ''
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
  v_name_key := public.normalize_identity_token(in_name);
  v_slug_key := public.normalize_identity_token(in_slug);
  v_base_key := COALESCE(v_name_key, v_slug_key, 'unknown-player');

  IF in_birth_date IS NOT NULL THEN
    RETURN v_base_key || '::' || TO_CHAR(in_birth_date, 'YYYYMMDD');
  END IF;

  RETURN v_base_key;
END;
$$;

-- 3) Rebuild player masters from players using the canonical key
UPDATE public.players SET player_master_id = NULL;
DELETE FROM public.player_masters;

INSERT INTO public.player_masters (id, master_key, canonical_slug, canonical_name, canonical_birth_date)
SELECT
  gen_random_uuid(),
  public.build_player_master_key(slug, name, birth_date, ''),
  MIN(slug),
  UPPER(MAX(name)),
  MAX(birth_date)
FROM public.players
WHERE name IS NOT NULL
GROUP BY public.build_player_master_key(slug, name, birth_date, '')
ON CONFLICT (master_key) DO NOTHING;

UPDATE public.players p
SET player_master_id = pm.id
FROM public.player_masters pm
WHERE pm.master_key = public.build_player_master_key(p.slug, p.name, p.birth_date, '');

-- 4) Create missing teams for canonical 4-part player team keys that do not exist in teams
WITH missing_keys AS (
  SELECT DISTINCT p.team_key
  FROM public.players p
  WHERE p.team_key IS NOT NULL
    AND p.team_key <> ''
    AND regexp_count(p.team_key, '::') = 3
    AND NOT EXISTS (
      SELECT 1 FROM public.teams t WHERE t.team_key = p.team_key
    )
),
parsed AS (
  SELECT
    mk.team_key,
    split_part(mk.team_key, '::', 1) AS club_key,
    split_part(mk.team_key, '::', 2) AS team_key_part,
    split_part(mk.team_key, '::', 3) AS category_key,
    split_part(mk.team_key, '::', 4) AS season_key
  FROM missing_keys mk
),
club_match AS (
  SELECT
    p.*,
    c.id AS club_id,
    c.name AS club_name
  FROM parsed p
  LEFT JOIN public.clubs c
    ON LOWER(BTRIM(c.name)) = LOWER(BTRIM(p.club_key))
),
source_team AS (
  SELECT DISTINCT ON (cm.team_key)
    cm.team_key,
    cm.club_id,
    COALESCE(cm.club_name, cm.club_key) AS club_name,
    cm.team_key_part AS team_name,
    cm.category_key AS category,
    cm.season_key AS season,
    prev.jok_id AS jok_id
  FROM club_match cm
  LEFT JOIN public.teams prev
    ON LOWER(BTRIM(prev.club_name)) = LOWER(BTRIM(COALESCE(cm.club_name, cm.club_key)))
   AND LOWER(BTRIM(prev.team_name)) = LOWER(BTRIM(cm.team_key_part))
   AND LOWER(BTRIM(prev.category)) = LOWER(BTRIM(cm.category_key))
  ORDER BY cm.team_key, prev.season DESC NULLS LAST
)
INSERT INTO public.teams (club_id, club_name, team_name, category, season, team_key, jok_id, created_at, updated_at)
SELECT
  st.club_id,
  st.club_name,
  st.team_name,
  st.category,
  st.season,
  st.team_key,
  st.jok_id,
  NOW(),
  NOW()
FROM source_team st
WHERE NOT EXISTS (
  SELECT 1 FROM public.teams t WHERE t.team_key = st.team_key
);

-- 5) Final team relink by canonical team_key
UPDATE public.players p
SET primary_team_id = t.id
FROM public.teams t
WHERE p.team_key = t.team_key
  AND (p.primary_team_id IS NULL OR p.primary_team_id <> t.id);

COMMIT;

-- 6) Verification
SELECT 'players_total' AS metric, COUNT(*) AS count FROM public.players
UNION ALL
SELECT 'players_with_team', COUNT(*) FROM public.players WHERE primary_team_id IS NOT NULL
UNION ALL
SELECT 'players_without_team', COUNT(*) FROM public.players WHERE primary_team_id IS NULL
UNION ALL
SELECT 'players_without_master', COUNT(*) FROM public.players WHERE player_master_id IS NULL
UNION ALL
SELECT 'masters_total', COUNT(*) FROM public.player_masters
UNION ALL
SELECT 'players_teamkey_3parts', COUNT(*) FROM public.players WHERE team_key IS NOT NULL AND regexp_count(team_key, '::') = 2;

-- ============================================================================
-- Bulk backfill for players missing team linkage (global fix)
--
-- Goal:
-- - Fill players.primary_team_id and players.team_key when currently NULL/empty.
-- - Works for all players, not just specific cases (MARTI/MATEU).
--
-- Strategy:
-- 1) SAFE pass: only players whose same jok_id has exactly ONE known team signature
--    across other seasons (unambiguous).
-- 2) FALLBACK pass: nearest known season for same jok_id (best effort).
--
-- Canonical team_key format: club::team::category::season
-- ============================================================================

BEGIN;

-- Snapshot current missing count (informational)
SELECT 'before_missing_team' AS metric, COUNT(*) AS count
FROM public.players
WHERE primary_team_id IS NULL
  AND (team_key IS NULL OR team_key = '');

-- --------------------------------------------------------------------------
-- PASS 1: SAFE (UNAMBIGUOUS PER JOK_ID)
-- --------------------------------------------------------------------------
WITH targets AS (
  SELECT
    p.id AS player_id,
    p.jok_id,
    p.season AS target_season
  FROM public.players p
  WHERE p.jok_id IS NOT NULL
    AND p.primary_team_id IS NULL
    AND (p.team_key IS NULL OR p.team_key = '')
),
known_teams AS (
  SELECT
    p.jok_id,
    t.club_id,
    t.club_name,
    t.team_name,
    t.category,
    t.jok_id AS team_jok_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.jok_id
      ORDER BY p.season DESC
    ) AS rn
  FROM public.players p
  JOIN public.teams t ON t.id = p.primary_team_id
  WHERE p.jok_id IS NOT NULL
),
signature_counts AS (
  SELECT
    p.jok_id,
    COUNT(DISTINCT (LOWER(BTRIM(t.club_name)) || '||' || LOWER(BTRIM(t.team_name)) || '||' || LOWER(BTRIM(t.category)))) AS signature_count
  FROM public.players p
  JOIN public.teams t ON t.id = p.primary_team_id
  WHERE p.jok_id IS NOT NULL
  GROUP BY p.jok_id
),
chosen AS (
  SELECT
    kt.jok_id,
    kt.club_id,
    kt.club_name,
    kt.team_name,
    kt.category,
    kt.team_jok_id
  FROM known_teams kt
  JOIN signature_counts sc ON sc.jok_id = kt.jok_id
  WHERE sc.signature_count = 1
    AND kt.rn = 1
),
resolved AS (
  SELECT
    tg.player_id,
    tg.jok_id,
    tg.target_season,
    ch.club_id,
    ch.club_name,
    ch.team_name,
    ch.category,
    ch.team_jok_id,
    LOWER(BTRIM(ch.club_name)) || '::' ||
    LOWER(BTRIM(ch.team_name)) || '::' ||
    LOWER(BTRIM(ch.category)) || '::' ||
    BTRIM(tg.target_season) AS target_team_key
  FROM targets tg
  JOIN chosen ch ON ch.jok_id = tg.jok_id
),
resolved_unique AS (
  SELECT DISTINCT ON (club_id, team_name, category, target_season)
    club_id,
    club_name,
    team_name,
    category,
    target_season,
    target_team_key,
    team_jok_id
  FROM resolved
  ORDER BY club_id, team_name, category, target_season, team_jok_id DESC NULLS LAST
),
insert_missing_teams AS (
  INSERT INTO public.teams (
    club_id, club_name, team_name, category, season, team_key, jok_id, created_at, updated_at
  )
  SELECT
    ru.club_id,
    ru.club_name,
    ru.team_name,
    ru.category,
    ru.target_season,
    ru.target_team_key,
    ru.team_jok_id,
    NOW(),
    NOW()
  FROM resolved_unique ru
  ON CONFLICT (club_id, team_name, category, season)
  DO UPDATE SET
    team_key = EXCLUDED.team_key,
    club_name = EXCLUDED.club_name,
    jok_id = COALESCE(public.teams.jok_id, EXCLUDED.jok_id),
    updated_at = NOW()
  RETURNING id
)
UPDATE public.players p
SET
  team_key = r.target_team_key,
  primary_team_id = t.id
FROM resolved r
JOIN public.teams t ON t.team_key = r.target_team_key
WHERE p.id = r.player_id
  AND p.primary_team_id IS NULL
  AND (p.team_key IS NULL OR p.team_key = '');

-- --------------------------------------------------------------------------
-- PASS 2: FALLBACK (NEAREST KNOWN SEASON PER JOK_ID)
-- --------------------------------------------------------------------------
WITH targets AS (
  SELECT
    p.id AS player_id,
    p.jok_id,
    p.season AS target_season,
    split_part(p.season, '-', 1)::INT AS target_year
  FROM public.players p
  WHERE p.jok_id IS NOT NULL
    AND p.primary_team_id IS NULL
    AND (p.team_key IS NULL OR p.team_key = '')
),
known AS (
  SELECT
    p.jok_id,
    p.season AS source_season,
    split_part(p.season, '-', 1)::INT AS source_year,
    t.club_id,
    t.club_name,
    t.team_name,
    t.category,
    t.jok_id AS team_jok_id
  FROM public.players p
  JOIN public.teams t ON t.id = p.primary_team_id
  WHERE p.jok_id IS NOT NULL
),
nearest AS (
  SELECT DISTINCT ON (tg.player_id)
    tg.player_id,
    tg.jok_id,
    tg.target_season,
    k.club_id,
    k.club_name,
    k.team_name,
    k.category,
    k.team_jok_id,
    LOWER(BTRIM(k.club_name)) || '::' ||
    LOWER(BTRIM(k.team_name)) || '::' ||
    LOWER(BTRIM(k.category)) || '::' ||
    BTRIM(tg.target_season) AS target_team_key,
    (CASE WHEN k.source_year <= tg.target_year THEN 0 ELSE 1 END) AS prefer_past,
    ABS(k.source_year - tg.target_year) AS distance
  FROM targets tg
  JOIN known k ON k.jok_id = tg.jok_id
  ORDER BY tg.player_id, prefer_past, distance, k.source_year DESC
),
nearest_unique AS (
  SELECT DISTINCT ON (club_id, team_name, category, target_season)
    club_id,
    club_name,
    team_name,
    category,
    target_season,
    target_team_key,
    team_jok_id
  FROM nearest
  ORDER BY club_id, team_name, category, target_season, team_jok_id DESC NULLS LAST
),
insert_missing_teams AS (
  INSERT INTO public.teams (
    club_id, club_name, team_name, category, season, team_key, jok_id, created_at, updated_at
  )
  SELECT
    nu.club_id,
    nu.club_name,
    nu.team_name,
    nu.category,
    nu.target_season,
    nu.target_team_key,
    nu.team_jok_id,
    NOW(),
    NOW()
  FROM nearest_unique nu
  ON CONFLICT (club_id, team_name, category, season)
  DO UPDATE SET
    team_key = EXCLUDED.team_key,
    club_name = EXCLUDED.club_name,
    jok_id = COALESCE(public.teams.jok_id, EXCLUDED.jok_id),
    updated_at = NOW()
  RETURNING id
)
UPDATE public.players p
SET
  team_key = n.target_team_key,
  primary_team_id = t.id
FROM nearest n
JOIN public.teams t ON t.team_key = n.target_team_key
WHERE p.id = n.player_id
  AND p.primary_team_id IS NULL
  AND (p.team_key IS NULL OR p.team_key = '');

COMMIT;

-- Final verification
SELECT 'players_total' AS metric, COUNT(*) AS count
FROM public.players
UNION ALL
SELECT 'players_with_team', COUNT(*)
FROM public.players
WHERE primary_team_id IS NOT NULL
UNION ALL
SELECT 'players_without_team', COUNT(*)
FROM public.players
WHERE primary_team_id IS NULL
UNION ALL
SELECT 'players_teamkey_empty_or_null', COUNT(*)
FROM public.players
WHERE team_key IS NULL OR team_key = ''
UNION ALL
SELECT 'players_teamkey_3parts', COUNT(*)
FROM public.players
WHERE team_key IS NOT NULL AND regexp_count(team_key, '::') = 2
UNION ALL
SELECT 'players_with_broken_team_fk', COUNT(*)
FROM public.players p
LEFT JOIN public.teams t ON t.id = p.primary_team_id
WHERE p.primary_team_id IS NOT NULL
  AND t.id IS NULL;

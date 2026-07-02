-- ═══════════════════════════════════════════════════════════════════════════
-- Enforce canonical team identity across clubs/teams/players
-- Canonical team_key format: club::team::category::season (4 parts)
-- Matching priority in app/sync: team_jok_id (if available) -> team_key
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1) Ensure teams.team_key is present and canonical
UPDATE public.teams t
SET team_key = LOWER(BTRIM(COALESCE(t.club_name, ''))) || '::'
            || LOWER(BTRIM(COALESCE(t.team_name, ''))) || '::'
            || LOWER(BTRIM(COALESCE(t.category, ''))) || '::'
            || BTRIM(COALESCE(t.season, ''))
WHERE t.team_key IS NULL
   OR t.team_key = ''
   OR regexp_count(t.team_key, '::') <> 3;

-- 2) Backfill players.team_key from linked team when possible
UPDATE public.players p
SET team_key = t.team_key
FROM public.teams t
WHERE p.primary_team_id = t.id
  AND (p.team_key IS NULL OR p.team_key = '' OR regexp_count(p.team_key, '::') <> 3);

-- 3) Upgrade legacy 3-part player keys (team::category::season) -> canonical 4-part
--    Only auto-map players where there is exactly one unambiguous team candidate.
WITH parsed_players AS (
  SELECT
    p.id,
    LOWER(SPLIT_PART(p.team_key, '::', 1)) AS p_team_name,
    LOWER(SPLIT_PART(p.team_key, '::', 2)) AS p_category,
    BTRIM(SPLIT_PART(p.team_key, '::', 3)) AS p_season
  FROM public.players p
  WHERE p.team_key IS NOT NULL
    AND p.team_key <> ''
    AND regexp_count(p.team_key, '::') = 2
),
candidate_map AS (
  SELECT
    pp.id AS player_id,
    t.id AS team_id,
    t.team_key AS canonical_team_key,
    COUNT(*) OVER (PARTITION BY pp.id) AS candidate_count
  FROM parsed_players pp
  JOIN public.teams t
    ON LOWER(unaccent(t.team_name)) = LOWER(unaccent(pp.p_team_name))
   AND LOWER(unaccent(t.category)) = LOWER(unaccent(pp.p_category))
   AND BTRIM(t.season) = pp.p_season
),
chosen AS (
  SELECT player_id, team_id, canonical_team_key
  FROM candidate_map
  WHERE candidate_count = 1
)
UPDATE public.players p
SET
  team_key = c.canonical_team_key,
  primary_team_id = COALESCE(p.primary_team_id, c.team_id)
FROM chosen c
WHERE p.id = c.player_id;

-- 4) Final relink by canonical team_key
UPDATE public.players p
SET primary_team_id = t.id
FROM public.teams t
WHERE p.team_key = t.team_key
  AND (p.primary_team_id IS NULL OR p.primary_team_id <> t.id);

-- 5) Indexes (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_team_key
  ON public.teams (team_key);

CREATE INDEX IF NOT EXISTS idx_teams_jok_id
  ON public.teams (jok_id)
  WHERE jok_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_players_team_key
  ON public.players (team_key);

-- 6) Constraints (add once, validate after normalization)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teams_team_key_4parts_chk'
      AND conrelid = 'public.teams'::regclass
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_team_key_4parts_chk
      CHECK (team_key IS NOT NULL AND team_key <> '' AND regexp_count(team_key, '::') = 3)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_team_key_4parts_or_null_chk'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_team_key_4parts_or_null_chk
      CHECK (team_key IS NULL OR team_key = '' OR regexp_count(team_key, '::') = 3)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.teams VALIDATE CONSTRAINT teams_team_key_4parts_chk;
ALTER TABLE public.players VALIDATE CONSTRAINT players_team_key_4parts_or_null_chk;

COMMIT;

-- 7) Verification
SELECT 'teams_total' AS metric, COUNT(*) AS count
FROM public.teams
UNION ALL
SELECT 'teams_with_jok_id', COUNT(*)
FROM public.teams WHERE jok_id IS NOT NULL
UNION ALL
SELECT 'teams_team_key_4parts', COUNT(*)
FROM public.teams WHERE team_key IS NOT NULL AND team_key <> '' AND regexp_count(team_key, '::') = 3
UNION ALL
SELECT 'players_total', COUNT(*)
FROM public.players
UNION ALL
SELECT 'players_with_primary_team_id', COUNT(*)
FROM public.players WHERE primary_team_id IS NOT NULL
UNION ALL
SELECT 'players_without_primary_team_id', COUNT(*)
FROM public.players WHERE primary_team_id IS NULL
UNION ALL
SELECT 'players_team_key_3parts', COUNT(*)
FROM public.players WHERE team_key IS NOT NULL AND regexp_count(team_key, '::') = 2
UNION ALL
SELECT 'players_team_key_4parts_or_empty', COUNT(*)
FROM public.players WHERE team_key IS NULL OR team_key = '' OR regexp_count(team_key, '::') = 3;

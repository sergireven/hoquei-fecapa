-- ═══════════════════════════════════════════════════════════════════════════
-- MASTER FIX: Execute these in order to prepare database for sync
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Normalize all existing player slugs (remove accents)
UPDATE public.players 
SET slug = UPPER(unaccent(slug))
WHERE slug IS NOT NULL;

-- STEP 2: Backfill team_key from teams table (join by normalized team_name + season)
UPDATE public.players p
SET team_key = t.team_key
FROM public.teams t
WHERE p.team_key IS NULL 
  AND p.team_name IS NOT NULL
  AND p.season = t.season
  AND LOWER(REGEXP_REPLACE(unaccent(p.team_name), '[^a-z0-9]+', '', 'g')) 
    = LOWER(REGEXP_REPLACE(unaccent(t.team_name), '[^a-z0-9]+', '', 'g'));

-- STEP 3: Delete orphan player_masters (those with UUID pattern keys, except unknown-player pattern)
DELETE FROM public.player_masters
WHERE master_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}::'
  AND master_key !~ '^unknown-player';

-- STEP 4: Rebuild player_masters by grouping normalized identity
DELETE FROM public.player_masters;

INSERT INTO public.player_masters (id, master_key, canonical_slug, canonical_name, canonical_birth_date)
SELECT 
  gen_random_uuid(),
  CONCAT(
    LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
    '::',
    COALESCE(TO_CHAR(birth_date, 'YYYYMMDD'), 'unknown')
  ),
  slug,
  UPPER(name),
  birth_date
FROM (
  SELECT DISTINCT ON (
    LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
    COALESCE(birth_date, '1900-01-01'::date)
  )
    slug,
    name,
    birth_date
  FROM public.players
  ORDER BY 
    LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
    COALESCE(birth_date, '1900-01-01'::date)
);

-- STEP 5: Link players back to rebuilt masters
UPDATE public.players p
SET player_master_id = pm.id
FROM public.player_masters pm
WHERE pm.master_key = CONCAT(
  LOWER(REGEXP_REPLACE(unaccent(p.slug), '[^a-z0-9]+', '', 'g')),
  '::',
  COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown')
);

-- STEP 6: Drop old problematic constraints
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS "players_slug_team_name_season_key";
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS "players_slug_team_key_season_key";

-- STEP 7: Drop old indexes
DROP INDEX IF EXISTS idx_players_team_name;
DROP INDEX IF EXISTS idx_players_jok_id_unique;

-- STEP 8: Create optimal indexes for UPSERT
CREATE INDEX IF NOT EXISTS idx_players_slug ON public.players (slug);
CREATE INDEX IF NOT EXISTS idx_players_team_key ON public.players (team_key);
CREATE INDEX IF NOT EXISTS idx_players_season ON public.players (season);
CREATE INDEX IF NOT EXISTS idx_players_jok_id ON public.players (jok_id);

-- STEP 9: Create composite UNIQUE constraint for UPSERT
ALTER TABLE public.players
  ADD CONSTRAINT "players_slug_team_key_season_key" UNIQUE (slug, team_key, season);

-- STEP 10: Verify results
SELECT 
  'player_masters' as entity,
  COUNT(*) as count
FROM public.player_masters
UNION ALL
SELECT 'players with master_id',
  COUNT(*)
FROM public.players
WHERE player_master_id IS NOT NULL
UNION ALL
SELECT 'players with team_key',
  COUNT(*)
FROM public.players
WHERE team_key IS NOT NULL
UNION ALL
SELECT 'Verification: MARTI APARICIO CASAS masters',
  COUNT(DISTINCT id)
FROM public.player_masters
WHERE canonical_name LIKE '%MARTI%APARICIO%';

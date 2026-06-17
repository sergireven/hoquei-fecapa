-- Post-import validation for CSV bulk load into core tables
-- Tables validated:
--   public.clubs
--   public.teams
--   public.players
--   public.competitions
--   public.competition_teams
--
-- Run this after importing CSV files in this order:
-- 1) clubs
-- 2) teams
-- 3) competitions
-- 4) players
-- 5) competition_teams

-- 1) High-level row counts
SELECT 'clubs' AS table_name, COUNT(*) AS rows FROM public.clubs
UNION ALL
SELECT 'teams', COUNT(*) FROM public.teams
UNION ALL
SELECT 'players', COUNT(*) FROM public.players
UNION ALL
SELECT 'competitions', COUNT(*) FROM public.competitions
UNION ALL
SELECT 'competition_teams', COUNT(*) FROM public.competition_teams
ORDER BY table_name;

-- 2) Duplicate checks against natural keys
SELECT 'clubs.name' AS check_name, name AS key_value, COUNT(*) AS dup_count
FROM public.clubs
GROUP BY name
HAVING COUNT(*) > 1;

SELECT 'teams.club_id+team_name+category+season' AS check_name,
       CONCAT_WS(' | ', club_id::text, team_name, category, season) AS key_value,
       COUNT(*) AS dup_count
FROM public.teams
GROUP BY club_id, team_name, category, season
HAVING COUNT(*) > 1;

SELECT 'competitions.name+season+category' AS check_name,
       CONCAT_WS(' | ', name, season, category) AS key_value,
       COUNT(*) AS dup_count
FROM public.competitions
GROUP BY name, season, category
HAVING COUNT(*) > 1;

SELECT 'competition_teams.competition_id+team_id' AS check_name,
       CONCAT_WS(' | ', competition_id::text, team_id::text) AS key_value,
       COUNT(*) AS dup_count
FROM public.competition_teams
GROUP BY competition_id, team_id
HAVING COUNT(*) > 1;

-- 3) Mandatory field empties (NOT NULL/required semantics)
SELECT 'clubs missing name' AS check_name, COUNT(*) AS bad_rows
FROM public.clubs
WHERE COALESCE(TRIM(name), '') = '';

SELECT 'teams missing required text fields' AS check_name, COUNT(*) AS bad_rows
FROM public.teams
WHERE COALESCE(TRIM(club_name), '') = ''
   OR COALESCE(TRIM(team_name), '') = ''
   OR COALESCE(TRIM(category), '') = ''
   OR COALESCE(TRIM(season), '') = ''
   OR COALESCE(TRIM(team_key), '') = '';

SELECT 'players missing required fields' AS check_name, COUNT(*) AS bad_rows
FROM public.players
WHERE COALESCE(TRIM(name), '') = ''
   OR COALESCE(TRIM(season), '') = '';

SELECT 'competitions missing required fields' AS check_name, COUNT(*) AS bad_rows
FROM public.competitions
WHERE COALESCE(TRIM(name), '') = ''
   OR COALESCE(TRIM(category), '') = ''
   OR COALESCE(TRIM(season), '') = ''
   OR COALESCE(TRIM(competition_type), '') = '';

-- 4) Referential integrity checks (independent of FK constraint status)
SELECT 'teams.club_id without parent club' AS check_name, COUNT(*) AS bad_rows
FROM public.teams t
LEFT JOIN public.clubs c ON c.id = t.club_id
WHERE c.id IS NULL;

SELECT 'players.primary_team_id without parent team' AS check_name, COUNT(*) AS bad_rows
FROM public.players p
LEFT JOIN public.teams t ON t.id = p.primary_team_id
WHERE p.primary_team_id IS NOT NULL
  AND t.id IS NULL;

SELECT 'competition_teams.competition_id without parent competition' AS check_name, COUNT(*) AS bad_rows
FROM public.competition_teams ct
LEFT JOIN public.competitions c ON c.id = ct.competition_id
WHERE c.id IS NULL;

SELECT 'competition_teams.team_id without parent team' AS check_name, COUNT(*) AS bad_rows
FROM public.competition_teams ct
LEFT JOIN public.teams t ON t.id = ct.team_id
WHERE t.id IS NULL;

-- 5) Season coverage overview
SELECT season, COUNT(*) AS teams
FROM public.teams
GROUP BY season
ORDER BY season;

SELECT season, COUNT(*) AS players
FROM public.players
GROUP BY season
ORDER BY season;

SELECT season, COUNT(*) AS competitions
FROM public.competitions
GROUP BY season
ORDER BY season;

SELECT c.season, COUNT(*) AS competition_team_rows
FROM public.competition_teams ct
JOIN public.competitions c ON c.id = ct.competition_id
GROUP BY c.season
ORDER BY c.season;

-- 6) Consistency checks
-- competitions.total_teams should match actual junction rows
SELECT c.id, c.name, c.season, c.total_teams,
       COALESCE(real_counts.real_total, 0) AS real_total
FROM public.competitions c
LEFT JOIN (
  SELECT competition_id, COUNT(*) AS real_total
  FROM public.competition_teams
  GROUP BY competition_id
) real_counts ON real_counts.competition_id = c.id
WHERE c.total_teams <> COALESCE(real_counts.real_total, 0)
ORDER BY c.season, c.name;

-- Teams assigned to more than one club (should be impossible by ID, but useful sanity check by name+season)
SELECT LOWER(TRIM(team_name)) AS team_name_norm,
       season,
       COUNT(DISTINCT club_id) AS distinct_clubs
FROM public.teams
GROUP BY LOWER(TRIM(team_name)), season
HAVING COUNT(DISTINCT club_id) > 1
ORDER BY distinct_clubs DESC, season, team_name_norm;

-- 7) Optional: quick sample joins for manual QA
SELECT t.season, t.club_name, t.team_name, c.name AS competition_name, ct.league_position
FROM public.competition_teams ct
JOIN public.teams t ON t.id = ct.team_id
JOIN public.competitions c ON c.id = ct.competition_id
ORDER BY t.season, t.club_name, t.team_name
LIMIT 100;

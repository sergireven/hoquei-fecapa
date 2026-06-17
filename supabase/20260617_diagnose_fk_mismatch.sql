-- Diagnostic script: identify why FK constraints are failing
-- Run this to understand the mismatch between CSV data and existing table data

-- 1) Check if tables have data
SELECT 'clubs' AS tbl, COUNT(*) AS rows FROM public.clubs
UNION ALL SELECT 'teams', COUNT(*) FROM public.teams
UNION ALL SELECT 'competitions', COUNT(*) FROM public.competitions
UNION ALL SELECT 'players', COUNT(*) FROM public.players
UNION ALL SELECT 'competition_teams', COUNT(*) FROM public.competition_teams;

-- 2) Check for orphaned team.club_id (teams with non-existent club_id)
SELECT COUNT(*) AS orphaned_teams_club_fk
FROM public.teams t
WHERE NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = t.club_id);

-- 3) Check for orphaned competition_teams.competition_id
SELECT COUNT(*) AS orphaned_ct_competition_fk
FROM public.competition_teams ct
WHERE NOT EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = ct.competition_id);

-- 4) Check for orphaned competition_teams.team_id
SELECT COUNT(*) AS orphaned_ct_team_fk
FROM public.competition_teams ct
WHERE NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = ct.team_id);

-- 5) Check for orphaned players.primary_team_id (nullable FK but if NOT NULL must exist)
SELECT COUNT(*) AS orphaned_players_team_fk
FROM public.players p
WHERE p.primary_team_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = p.primary_team_id);

-- 6) Sample: show first 5 orphaned players with bad team refs
SELECT p.id, p.name, p.primary_team_id, COUNT(*) as matches
FROM public.players p
LEFT JOIN public.teams t ON t.id = p.primary_team_id
WHERE p.primary_team_id IS NOT NULL AND t.id IS NULL
GROUP BY p.id, p.name, p.primary_team_id
LIMIT 5;

-- 7) Sample: show first 5 orphaned competition_teams with bad competition refs
SELECT ct.id, ct.team_id, ct.competition_id
FROM public.competition_teams ct
LEFT JOIN public.competitions c ON c.id = ct.competition_id
WHERE c.id IS NULL
LIMIT 5;

-- 8) Check if CSV-generated IDs exist in competitions table
-- (this would indicate the CSV was never fully imported)
SELECT COUNT(*) AS competitions_with_data
FROM public.competitions;

-- 9) High-level UUID format check (ensure they're valid UUIDs)
SELECT COUNT(*) AS invalid_club_ids
FROM public.clubs
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

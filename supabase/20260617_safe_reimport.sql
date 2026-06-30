-- Safe reimport script: clean state + reimport all CSVs in correct order
-- 
-- IMPORTANT: This assumes you have CSV files ready in Supabase File Storage
-- or that you'll paste the raw data below via the SQL Editor's COPY FROM STDIN
--
-- Execution strategy:
-- 1. Temporarily disable FK constraints
-- 2. Truncate all core tables (reverse dependency order)
-- 3. Re-upload CSVs via Supabase UI in this order:
--    - clubs
--    - teams  
--    - competitions
--    - players
--    - competition_teams
-- 4. Re-enable FK constraints
-- 5. Run validation

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Disable FK constraints to allow clean re-import
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.competition_teams DISABLE TRIGGER ALL;
ALTER TABLE public.players DISABLE TRIGGER ALL;
ALTER TABLE public.teams DISABLE TRIGGER ALL;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Truncate tables in reverse dependency order
-- ═══════════════════════════════════════════════════════════════════════════

TRUNCATE TABLE public.competition_teams CASCADE;
TRUNCATE TABLE public.players CASCADE;
TRUNCATE TABLE public.competitions CASCADE;
TRUNCATE TABLE public.teams CASCADE;
TRUNCATE TABLE public.clubs CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Re-upload CSVs in this order via Supabase Studio:
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- 1. Upload: public/db-csv/clubs.csv
--    → Choose "Insert" mode (not replace)
--    → Ensure columns map: id, name, jok_key, created_at, updated_at
--
-- 2. Upload: public/db-csv/teams.csv
--    → Ensure columns map: id, club_id, club_name, team_name, category, season, team_key, created_at, updated_at
--
-- 3. Upload: public/db-csv/competitions.csv
--    → Ensure columns map: id, name, competition_code, category, season, competition_type, league_name, regional_level, total_teams, is_finished, created_at, updated_at
--
-- 4. Upload: public/db-csv/players.csv
--    → Ensure columns map: id, primary_team_id, name, slug, dorsal, position, is_goalkeeper, season, created_at, updated_at
--
-- 5. Upload: public/db-csv/competition_teams.csv
--    → Ensure columns map: id, competition_id, team_id, team_seed, league_position, matches_played, wins, draws, losses, points_for, points_against, joined_at, created_at, updated_at

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Re-enable triggers & FK constraints
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.teams ENABLE TRIGGER ALL;
ALTER TABLE public.players ENABLE TRIGGER ALL;
ALTER TABLE public.competition_teams ENABLE TRIGGER ALL;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: Validate import (run after all CSVs are uploaded)
-- ═══════════════════════════════════════════════════════════════════════════

-- Quick sanity checks
SELECT 'clubs' AS table_name, COUNT(*) AS rows FROM public.clubs
UNION ALL
SELECT 'teams', COUNT(*) FROM public.teams
UNION ALL
SELECT 'competitions', COUNT(*) FROM public.competitions
UNION ALL
SELECT 'players', COUNT(*) FROM public.players
UNION ALL
SELECT 'competition_teams', COUNT(*) FROM public.competition_teams
ORDER BY table_name;

-- Check for FK violations after reimport
SELECT 'orphaned_teams.club_id' AS violation_type, COUNT(*) AS bad_rows
FROM public.teams t
WHERE NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = t.club_id)
UNION ALL
SELECT 'orphaned_competition_teams.competition_id', COUNT(*)
FROM public.competition_teams ct
WHERE NOT EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = ct.competition_id)
UNION ALL
SELECT 'orphaned_competition_teams.team_id', COUNT(*)
FROM public.competition_teams ct
WHERE NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = ct.team_id)
UNION ALL
SELECT 'orphaned_players.primary_team_id', COUNT(*)
FROM public.players p
WHERE p.primary_team_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = p.primary_team_id);

-- If all checks return 0, import was successful!

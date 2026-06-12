-- Fix idempotent RLS policies for re-running core_entities safely
-- Run this before re-running 20260612_core_entities.sql

-- clubs
DROP POLICY IF EXISTS "clubs: public read"  ON public.clubs;
DROP POLICY IF EXISTS "clubs: auth insert"  ON public.clubs;
DROP POLICY IF EXISTS "clubs: auth update"  ON public.clubs;

-- teams
DROP POLICY IF EXISTS "teams: public read"  ON public.teams;
DROP POLICY IF EXISTS "teams: auth insert"  ON public.teams;
DROP POLICY IF EXISTS "teams: auth update"  ON public.teams;

-- players
DROP POLICY IF EXISTS "players: public read"  ON public.players;
DROP POLICY IF EXISTS "players: auth insert"  ON public.players;
DROP POLICY IF EXISTS "players: auth update"  ON public.players;

-- convocatorias
DROP POLICY IF EXISTS "conv: coordinator select"  ON public.convocatorias;
DROP POLICY IF EXISTS "conv: coordinator insert"  ON public.convocatorias;
DROP POLICY IF EXISTS "conv: coordinator update"  ON public.convocatorias;
DROP POLICY IF EXISTS "conv: coordinator delete"  ON public.convocatorias;
DROP POLICY IF EXISTS "conv: authenticated read"  ON public.convocatorias;

-- shared_trainings
DROP POLICY IF EXISTS "training: auth read"  ON public.shared_trainings;
DROP POLICY IF EXISTS "training: auth insert"  ON public.shared_trainings;
DROP POLICY IF EXISTS "training: creator or enricher update"  ON public.shared_trainings;
DROP POLICY IF EXISTS "training: creator delete"  ON public.shared_trainings;

-- competitions
DROP POLICY IF EXISTS "competitions: public read"  ON public.competitions;
DROP POLICY IF EXISTS "competitions: auth insert"  ON public.competitions;
DROP POLICY IF EXISTS "competitions: auth update"  ON public.competitions;

-- competition_teams
DROP POLICY IF EXISTS "comp_teams: public read"  ON public.competition_teams;
DROP POLICY IF EXISTS "comp_teams: auth insert"  ON public.competition_teams;
DROP POLICY IF EXISTS "comp_teams: auth update"  ON public.competition_teams;
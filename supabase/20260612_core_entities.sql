-- ═══════════════════════════════════════════════════════════════════════════
-- Core domain entities: clubs, teams, players, convocatorias, shared trainings
-- These tables give every important object a stable UUID primary key so that
-- coordinator and coach panels always refer to the same records.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. clubs ────────────────────────────────────────────────────────────
-- Thin wrapper so teams and trainings can reference a club by UUID.
CREATE TABLE IF NOT EXISTS public.clubs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,          -- display / canonical name
  jok_key    TEXT,                                  -- optional JOK.cat club key
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubs_name ON public.clubs (name);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clubs: public read"  ON public.clubs FOR SELECT USING (TRUE);
CREATE POLICY "clubs: auth insert"  ON public.clubs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "clubs: auth update"  ON public.clubs FOR UPDATE USING (auth.uid() IS NOT NULL);


-- ─── 2. teams ─────────────────────────────────────────────────────────────
-- One row per logical team (club + category combination).
CREATE TABLE IF NOT EXISTS public.teams (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  club_name    TEXT        NOT NULL DEFAULT '',     -- denormalized for easy look-up
  team_name    TEXT        NOT NULL,
  category     TEXT        NOT NULL DEFAULT '',     -- e.g. 'benjami', 'juvenil'
  season       TEXT        NOT NULL DEFAULT '2025-26',
  team_key     TEXT        NOT NULL DEFAULT '',     -- internal key used in JS (name::cat)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, team_name, category, season)
);

CREATE INDEX IF NOT EXISTS idx_teams_club    ON public.teams (club_id);
CREATE INDEX IF NOT EXISTS idx_teams_name    ON public.teams (club_name, team_name);
CREATE INDEX IF NOT EXISTS idx_teams_season  ON public.teams (season);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams: public read"  ON public.teams FOR SELECT USING (TRUE);
CREATE POLICY "teams: auth insert"  ON public.teams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "teams: auth update"  ON public.teams FOR UPDATE USING (auth.uid() IS NOT NULL);


-- ─── 3. players ───────────────────────────────────────────────────────────
-- One row per registered player, linked to the team they mainly play for.
CREATE TABLE IF NOT EXISTS public.players (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_team_id UUID     REFERENCES public.teams(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL,
  slug         TEXT,                               -- URL-safe name used in existing app
  dorsal       TEXT        NOT NULL DEFAULT '',
  position     TEXT        NOT NULL DEFAULT 'Jugador',  -- 'Porter' | 'Jugador'
  is_goalkeeper BOOLEAN    NOT NULL DEFAULT FALSE,
  season       TEXT        NOT NULL DEFAULT '2025-26',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_team   ON public.players (primary_team_id);
CREATE INDEX IF NOT EXISTS idx_players_name   ON public.players (name);
CREATE INDEX IF NOT EXISTS idx_players_slug   ON public.players (slug);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players: public read"  ON public.players FOR SELECT USING (TRUE);
CREATE POLICY "players: auth insert"  ON public.players FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "players: auth update"  ON public.players FOR UPDATE USING (auth.uid() IS NOT NULL);


-- ─── 4. convocatorias ─────────────────────────────────────────────────────
-- One row per match call-up created by a coordinator.
-- Players are stored as JSONB so the schema stays flexible while the row
-- itself gets a stable UUID that users and coaches can reference.
CREATE TABLE IF NOT EXISTS public.convocatorias (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id          UUID        REFERENCES public.teams(id) ON DELETE SET NULL,
  competition_id   UUID        REFERENCES public.competitions(id) ON DELETE SET NULL,
  club_name        TEXT        NOT NULL DEFAULT '',
  team_name        TEXT        NOT NULL DEFAULT '',
  match_key        TEXT        NOT NULL DEFAULT '',  -- JS coordinator match key
  match_date       DATE,
  match_time       TIME,
  match_home       TEXT        NOT NULL DEFAULT '',
  match_away       TEXT        NOT NULL DEFAULT '',
  match_competition TEXT       NOT NULL DEFAULT '',  -- display name (now also has FK)
  match_location   TEXT        NOT NULL DEFAULT '',
  match_type       TEXT        NOT NULL DEFAULT 'federat',
  is_ad_hoc        BOOLEAN     NOT NULL DEFAULT FALSE,
  previous_match   JSONB                DEFAULT NULL,
  previous_match_key TEXT      NOT NULL DEFAULT '',
  -- players: [{ name, dorsal, position, checked, status, notes }]
  players          JSONB       NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coordinator_id, club_name, team_name, match_key)
);

-- Backward-compatible migration path: if convocatorias already existed
-- before competition_id was introduced, add the column and FK safely.
ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS competition_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'convocatorias_competition_id_fkey'
      AND conrelid = 'public.convocatorias'::regclass
  ) THEN
    ALTER TABLE public.convocatorias
      ADD CONSTRAINT convocatorias_competition_id_fkey
      FOREIGN KEY (competition_id)
      REFERENCES public.competitions(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- competitions may be created in a later migration file.
    RAISE NOTICE 'public.competitions not found yet; FK will be created when competitions exists.';
END $$;

CREATE INDEX IF NOT EXISTS idx_convocatorias_coordinator ON public.convocatorias (coordinator_id);
CREATE INDEX IF NOT EXISTS idx_convocatorias_team        ON public.convocatorias (team_id);
CREATE INDEX IF NOT EXISTS idx_convocatorias_competition ON public.convocatorias (competition_id);
CREATE INDEX IF NOT EXISTS idx_convocatorias_date        ON public.convocatorias (match_date);
CREATE INDEX IF NOT EXISTS idx_convocatorias_club_team   ON public.convocatorias (club_name, team_name);

ALTER TABLE public.convocatorias ENABLE ROW LEVEL SECURITY;

-- Coordinadors can fully manage their own convocatories
CREATE POLICY "conv: coordinator select"
  ON public.convocatorias FOR SELECT
  USING (auth.uid() = coordinator_id);

CREATE POLICY "conv: coordinator insert"
  ON public.convocatorias FOR INSERT
  WITH CHECK (auth.uid() = coordinator_id);

CREATE POLICY "conv: coordinator update"
  ON public.convocatorias FOR UPDATE
  USING (auth.uid() = coordinator_id)
  WITH CHECK (auth.uid() = coordinator_id);

CREATE POLICY "conv: coordinator delete"
  ON public.convocatorias FOR DELETE
  USING (auth.uid() = coordinator_id);

-- Any authenticated user can read convocatories (so players/parents can see them)
CREATE POLICY "conv: authenticated read"
  ON public.convocatorias FOR SELECT
  USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE  public.convocatorias IS 'Match call-ups created by coordinators. Players JSONB holds per-player status/notes. Links to competitions table.';
COMMENT ON COLUMN public.convocatorias.match_key         IS 'Encoded coordinator match key from the JS app (compId::dateKey::time::home::away)';
COMMENT ON COLUMN public.convocatorias.players           IS 'Array of {name, dorsal, position, checked, status, notes} objects';
COMMENT ON COLUMN public.convocatorias.competition_id    IS 'FK to competitions table — links match to its league/tournament';


-- ─── 5. shared_trainings ──────────────────────────────────────────────────
-- Replaces both coordinator_trainings and coach_training_plans with a single
-- shared object.  The coordinator fills logistics fields; the coach enriches
-- with pillars and notes.
CREATE TABLE IF NOT EXISTS public.shared_trainings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership / visibility
  club_name        TEXT        NOT NULL DEFAULT '',
  team_id          UUID        REFERENCES public.teams(id) ON DELETE SET NULL,
  team_name        TEXT        NOT NULL DEFAULT '',
  team_category    TEXT        NOT NULL DEFAULT '',
  season           TEXT        NOT NULL DEFAULT '2025-26',

  -- Logistics (set by coordinator)
  training_date    DATE        NOT NULL,
  training_time    TIME        NOT NULL,
  location         TEXT        NOT NULL DEFAULT '',
  locker_room      TEXT        NOT NULL DEFAULT '',
  duration_minutes INTEGER     NOT NULL DEFAULT 90 CHECK (duration_minutes > 0),
  recurrence       TEXT        NOT NULL DEFAULT 'none',  -- none | weekly | monthly
  series_start     DATE,
  series_end       DATE,

  -- Coach enrichment
  pillars          TEXT[]      NOT NULL DEFAULT '{}',
  focus_areas      TEXT[]               DEFAULT '{}',
  coach_notes      TEXT,

  -- General notes (shared)
  notes            TEXT,

  -- Soft refs to the users who created / last enriched
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  enriched_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_trainings_club     ON public.shared_trainings (club_name, team_name);
CREATE INDEX IF NOT EXISTS idx_shared_trainings_team_id  ON public.shared_trainings (team_id);
CREATE INDEX IF NOT EXISTS idx_shared_trainings_date     ON public.shared_trainings (training_date);
CREATE INDEX IF NOT EXISTS idx_shared_trainings_creator  ON public.shared_trainings (created_by);

ALTER TABLE public.shared_trainings ENABLE ROW LEVEL SECURITY;

-- Club members can read their club's trainings
CREATE POLICY "training: auth read"
  ON public.shared_trainings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only authenticated users can create
CREATE POLICY "training: auth insert"
  ON public.shared_trainings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Creator or enricher can update
CREATE POLICY "training: creator or enricher update"
  ON public.shared_trainings FOR UPDATE
  USING (auth.uid() = created_by OR auth.uid() = enriched_by)
  WITH CHECK (auth.uid() = created_by OR auth.uid() = enriched_by);

-- Only creator can delete
CREATE POLICY "training: creator delete"
  ON public.shared_trainings FOR DELETE
  USING (auth.uid() = created_by);

COMMENT ON TABLE  public.shared_trainings IS 'Shared training sessions: coordinator sets logistics, coach adds pedagogical content';
COMMENT ON COLUMN public.shared_trainings.pillars       IS 'Coach-selected pillars: tecnica, tactica, fisic, mental, defensa, atac';
COMMENT ON COLUMN public.shared_trainings.recurrence    IS 'none | weekly | monthly';

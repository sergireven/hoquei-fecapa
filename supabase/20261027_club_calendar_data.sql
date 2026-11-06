-- ═══════════════════════════════════════════════════════════════════════════
-- Calendari i conflictes del club (panell de coordinador)
--
-- Una sola taula clau-valor per club, compartida entre coordinadors:
--   kind = 'person'      → fitxa de persona (jugador, entrenador, delegat…)
--   kind = 'annotation'  → anotació per partit (porter de la rotació, reforç)
--   kind = 'block'       → franja de pista bloquejada (escola, cessió…)
--   kind = 'proposal'    → proposta de canvi pendent (simulador)
--   kind = 'config'      → configuració (item_id = 'main')
--
-- Lectura: coordinadors, entrenadors i admins. Escriptura: coordinadors i admins.
-- Executa-ho un cop a l'editor SQL de Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.club_calendar_data (
  club_name   TEXT        NOT NULL,
  kind        TEXT        NOT NULL CHECK (kind IN ('person', 'annotation', 'block', 'proposal', 'config')),
  item_id     TEXT        NOT NULL,
  data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_name, kind, item_id)
);

CREATE INDEX IF NOT EXISTS idx_club_calendar_data_club ON public.club_calendar_data (club_name);

CREATE OR REPLACE FUNCTION public.club_calendar_has_role(p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = ANY (p_roles)
        OR COALESCE(p.roles, ARRAY[]::text[]) && p_roles
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.club_calendar_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_calendar_touch ON public.club_calendar_data;
CREATE TRIGGER trg_club_calendar_touch
BEFORE INSERT OR UPDATE ON public.club_calendar_data
FOR EACH ROW EXECUTE FUNCTION public.club_calendar_touch();

ALTER TABLE public.club_calendar_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club calendar: read" ON public.club_calendar_data;
CREATE POLICY "club calendar: read" ON public.club_calendar_data
  FOR SELECT USING (public.club_calendar_has_role(ARRAY['coordinador', 'entrenador', 'admin']));

DROP POLICY IF EXISTS "club calendar: insert" ON public.club_calendar_data;
CREATE POLICY "club calendar: insert" ON public.club_calendar_data
  FOR INSERT WITH CHECK (public.club_calendar_has_role(ARRAY['coordinador', 'admin']));

DROP POLICY IF EXISTS "club calendar: update" ON public.club_calendar_data;
CREATE POLICY "club calendar: update" ON public.club_calendar_data
  FOR UPDATE USING (public.club_calendar_has_role(ARRAY['coordinador', 'admin']))
  WITH CHECK (public.club_calendar_has_role(ARRAY['coordinador', 'admin']));

DROP POLICY IF EXISTS "club calendar: delete" ON public.club_calendar_data;
CREATE POLICY "club calendar: delete" ON public.club_calendar_data
  FOR DELETE USING (public.club_calendar_has_role(ARRAY['coordinador', 'admin']));

COMMENT ON TABLE public.club_calendar_data IS 'Persones, anotacions, bloquejos de pista, propostes i configuració del calendari del club (panell coordinador).';

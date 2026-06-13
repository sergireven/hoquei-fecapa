-- Convocatoria player responses (junction table)
-- One row per player per tutor per convocatoria.
-- Tutors write their availability here; coordinators can read it all.
--
-- This replaces the previous convocatoria_tutor_responses table
-- for cross-panel synchronization. The old table is kept for backward compat.

CREATE TABLE IF NOT EXISTS public.convocatoria_player_responses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  convocatoria_id UUID        NOT NULL REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  tutor_id        UUID        NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  player_name     TEXT        NOT NULL,
  -- disponible | dubte | no_disponible
  status          TEXT        NOT NULL DEFAULT 'disponible',
  note            TEXT        NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (convocatoria_id, player_name, tutor_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_pr_conv   ON public.convocatoria_player_responses (convocatoria_id);
CREATE INDEX IF NOT EXISTS idx_conv_pr_tutor  ON public.convocatoria_player_responses (tutor_id);
CREATE INDEX IF NOT EXISTS idx_conv_pr_player ON public.convocatoria_player_responses (player_name);

ALTER TABLE public.convocatoria_player_responses ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read (coordinators need all tutor responses for their convocatories)
CREATE POLICY "conv_pr: auth read"
  ON public.convocatoria_player_responses FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Tutors can only write/update/delete their own responses
CREATE POLICY "conv_pr: tutor insert"
  ON public.convocatoria_player_responses FOR INSERT
  WITH CHECK (auth.uid() = tutor_id);

CREATE POLICY "conv_pr: tutor update"
  ON public.convocatoria_player_responses FOR UPDATE
  USING (auth.uid() = tutor_id)
  WITH CHECK (auth.uid() = tutor_id);

CREATE POLICY "conv_pr: tutor delete"
  ON public.convocatoria_player_responses FOR DELETE
  USING (auth.uid() = tutor_id);

COMMENT ON TABLE  public.convocatoria_player_responses IS 'Per-player availability responses from tutors, linked to coordinator convocatoria.';
COMMENT ON COLUMN public.convocatoria_player_responses.status IS 'disponible | dubte | no_disponible';
COMMENT ON COLUMN public.convocatoria_player_responses.note   IS 'Free-text note from the tutor';

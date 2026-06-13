-- Coordinator ad-hoc matches (friendlies, tournaments)
-- The JS app writes here via addCoordinatorAdHocMatch().
-- Read back on coordinator panel open to keep DB as primary source.

CREATE TABLE IF NOT EXISTS public.ad_hoc_matches (
  id              TEXT        PRIMARY KEY,   -- e.g. "adhoc_1718300000000_abc123"
  coach_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_name       TEXT        NOT NULL DEFAULT '',
  team_name       TEXT        NOT NULL DEFAULT '',
  type            TEXT        NOT NULL DEFAULT 'amistos',  -- amistos | torneig
  location        TEXT        NOT NULL DEFAULT '',
  match_date      TEXT        NOT NULL DEFAULT '',         -- stored as text DD/MM/YYYY
  match_time      TEXT        NOT NULL DEFAULT '',         -- HH:MM
  opponent        TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adhoc_user   ON public.ad_hoc_matches (coach_user_id);
CREATE INDEX IF NOT EXISTS idx_adhoc_club   ON public.ad_hoc_matches (club_name);
CREATE INDEX IF NOT EXISTS idx_adhoc_date   ON public.ad_hoc_matches (match_date);

ALTER TABLE public.ad_hoc_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adhoc: own select"
  ON public.ad_hoc_matches FOR SELECT
  USING (auth.uid() = coach_user_id);

CREATE POLICY "adhoc: own insert"
  ON public.ad_hoc_matches FOR INSERT
  WITH CHECK (auth.uid() = coach_user_id);

CREATE POLICY "adhoc: own update"
  ON public.ad_hoc_matches FOR UPDATE
  USING (auth.uid() = coach_user_id)
  WITH CHECK (auth.uid() = coach_user_id);

CREATE POLICY "adhoc: own delete"
  ON public.ad_hoc_matches FOR DELETE
  USING (auth.uid() = coach_user_id);

COMMENT ON TABLE  public.ad_hoc_matches IS 'Friendly matches and tournaments created by coordinator/coach users.';
COMMENT ON COLUMN public.ad_hoc_matches.type        IS 'amistos | torneig';
COMMENT ON COLUMN public.ad_hoc_matches.match_date  IS 'Date stored as text (DD/MM/YYYY) matching JS app format';

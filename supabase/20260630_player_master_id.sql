-- ═══════════════════════════════════════════════════════════════════════════
-- Global player identity across seasons
-- - player_masters: canonical, season-agnostic player entity
-- - players.player_master_id: links each seasonal player row to the global id
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.player_masters (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  master_key     TEXT        NOT NULL UNIQUE,
  canonical_slug TEXT,
  canonical_name TEXT        NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_masters_slug
  ON public.player_masters (canonical_slug);

CREATE INDEX IF NOT EXISTS idx_player_masters_name
  ON public.player_masters (canonical_name);

ALTER TABLE public.player_masters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_masters: public read"
  ON public.player_masters FOR SELECT
  USING (TRUE);

CREATE POLICY "player_masters: auth insert"
  ON public.player_masters FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "player_masters: auth update"
  ON public.player_masters FOR UPDATE
  USING (auth.uid() IS NOT NULL);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS player_master_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_player_master_id_fkey'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_player_master_id_fkey
      FOREIGN KEY (player_master_id)
      REFERENCES public.player_masters(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_players_player_master_id
  ON public.players (player_master_id);

WITH prepared AS (
  SELECT
    p.id AS player_id,
    NULLIF(BTRIM(p.slug), '') AS slug,
    NULLIF(BTRIM(p.name), '') AS name,
    COALESCE(
      NULLIF(LOWER(REGEXP_REPLACE(COALESCE(p.slug, ''), '[^a-z0-9]+', '', 'g')), ''),
      NULLIF(LOWER(REGEXP_REPLACE(COALESCE(p.name, ''), '[^a-z0-9]+', '', 'g')), ''),
      p.id::TEXT
    ) AS master_key
  FROM public.players p
),
masters AS (
  SELECT
    master_key,
    MIN(slug) FILTER (WHERE slug IS NOT NULL) AS canonical_slug,
    MIN(name) FILTER (WHERE name IS NOT NULL) AS canonical_name
  FROM prepared
  GROUP BY master_key
)
INSERT INTO public.player_masters (master_key, canonical_slug, canonical_name)
SELECT
  m.master_key,
  m.canonical_slug,
  COALESCE(m.canonical_name, 'Jugador sense nom')
FROM masters m
ON CONFLICT (master_key) DO UPDATE
SET
  canonical_slug = COALESCE(public.player_masters.canonical_slug, EXCLUDED.canonical_slug),
  canonical_name = COALESCE(NULLIF(public.player_masters.canonical_name, ''), EXCLUDED.canonical_name),
  updated_at = NOW();

WITH prepared AS (
  SELECT
    p.id AS player_id,
    COALESCE(
      NULLIF(LOWER(REGEXP_REPLACE(COALESCE(p.slug, ''), '[^a-z0-9]+', '', 'g')), ''),
      NULLIF(LOWER(REGEXP_REPLACE(COALESCE(p.name, ''), '[^a-z0-9]+', '', 'g')), ''),
      p.id::TEXT
    ) AS master_key
  FROM public.players p
)
UPDATE public.players p
SET player_master_id = pm.id
FROM prepared pr
JOIN public.player_masters pm ON pm.master_key = pr.master_key
WHERE p.id = pr.player_id
  AND p.player_master_id IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_player_master_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_master_key TEXT;
  v_master_id UUID;
BEGIN
  IF NEW.player_master_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_master_key := COALESCE(
    NULLIF(LOWER(REGEXP_REPLACE(COALESCE(NEW.slug, ''), '[^a-z0-9]+', '', 'g')), ''),
    NULLIF(LOWER(REGEXP_REPLACE(COALESCE(NEW.name, ''), '[^a-z0-9]+', '', 'g')), ''),
    NEW.id::TEXT
  );

  INSERT INTO public.player_masters (master_key, canonical_slug, canonical_name)
  VALUES (
    v_master_key,
    NULLIF(BTRIM(NEW.slug), ''),
    COALESCE(NULLIF(BTRIM(NEW.name), ''), 'Jugador sense nom')
  )
  ON CONFLICT (master_key) DO UPDATE
  SET
    canonical_slug = COALESCE(public.player_masters.canonical_slug, EXCLUDED.canonical_slug),
    canonical_name = COALESCE(NULLIF(public.player_masters.canonical_name, ''), EXCLUDED.canonical_name),
    updated_at = NOW()
  RETURNING id INTO v_master_id;

  NEW.player_master_id := v_master_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_players_ensure_master_id ON public.players;

CREATE TRIGGER trg_players_ensure_master_id
BEFORE INSERT OR UPDATE OF slug, name, player_master_id
ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.ensure_player_master_id();

COMMENT ON TABLE public.player_masters IS 'Global player identity across seasons.';
COMMENT ON COLUMN public.players.player_master_id IS 'Seasonal player row linked to a global player identity.';

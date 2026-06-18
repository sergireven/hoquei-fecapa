-- Add category support to coordinator ad-hoc matches.
-- Required by frontend filtering and persistence by team category.

ALTER TABLE public.ad_hoc_matches
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';

-- Defensive normalization for rows created before this migration.
UPDATE public.ad_hoc_matches
SET category = ''
WHERE category IS NULL;

CREATE INDEX IF NOT EXISTS idx_adhoc_category
  ON public.ad_hoc_matches (category);

COMMENT ON COLUMN public.ad_hoc_matches.category IS
  'Team category used to scope ad-hoc matches in convocatoria flows.';

-- Add optional jok.cat competition identifier to competitions
-- Example: https://jok.cat/competicio/4478/... -> jok_comp_id = '4478'

ALTER TABLE public.competitions
ADD COLUMN IF NOT EXISTS jok_comp_id TEXT;

COMMENT ON COLUMN public.competitions.jok_comp_id
IS 'External jok.cat competition ID used for pilot mapping (e.g. 4478).';

CREATE INDEX IF NOT EXISTS idx_competitions_jok_comp_id
ON public.competitions (jok_comp_id);

CREATE INDEX IF NOT EXISTS idx_competitions_season_jok_comp_id
ON public.competitions (season, jok_comp_id);

-- Mark competitions from season 2025-26 as finished.
-- Adds a persistent flag used by DB reads and CSV imports.

ALTER TABLE public.competitions
ADD COLUMN IF NOT EXISTS is_finished BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.competitions
SET is_finished = TRUE,
    updated_at = NOW()
WHERE season = '2025-26';

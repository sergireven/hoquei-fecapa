-- ═══════════════════════════════════════════════════════════════════════════
-- Recalculate canonical_name using best_player_display_name logic
-- Fixes issue where names were imported with + instead of spaces
-- ═══════════════════════════════════════════════════════════════════════════

WITH prepared AS (
  SELECT
    pm.id,
    pm.master_key,
    STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name)::TEXT AS all_names,
    STRING_AGG(DISTINCT p.slug, ', ' ORDER BY p.slug)::TEXT AS all_slugs,
    ARRAY_AGG(DISTINCT public.best_player_display_name(p.name, p.slug) ORDER BY public.best_player_display_name(p.name, p.slug)) AS name_candidates
  FROM public.player_masters pm
  LEFT JOIN public.players p ON p.player_master_id = pm.id
  GROUP BY pm.id, pm.master_key
),
best_names AS (
  SELECT
    id,
    (
      ARRAY_AGG(candidate
        ORDER BY
          COALESCE(array_length(regexp_split_to_array(candidate, '\\s+'), 1), 0) DESC,
          LENGTH(candidate) DESC,
          candidate ASC
      ) FILTER (WHERE candidate IS NOT NULL)
    )[1] AS best_name
  FROM (
    SELECT p.id, UNNEST(p.name_candidates) AS candidate
    FROM prepared p
  ) AS candidates
  GROUP BY id
)
UPDATE public.player_masters pm
SET
  canonical_name = bn.best_name,
  updated_at = NOW()
FROM best_names bn
WHERE pm.id = bn.id
  AND pm.canonical_name IS DISTINCT FROM bn.best_name;

COMMENT ON TABLE public.player_masters IS 'Global player identity across seasons. canonical_name now uses best_player_display_name logic to prefer full names over slugs, prioritizing names with more tokens and preserving accents.';

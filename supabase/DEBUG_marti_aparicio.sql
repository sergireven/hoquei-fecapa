-- DEBUG: See what's actually stored in the database for MARTÍ APARICIO CASAS
SELECT 
  p.id,
  p.name,
  p.slug,
  p.birth_date,
  public.normalize_identity_token(p.slug) as normalized_slug,
  public.normalize_identity_token(p.slug) || '::' || COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown') as would_be_master_key,
  p.season,
  p.player_master_id,
  pm.master_key,
  pm.canonical_name
FROM public.players p
LEFT JOIN public.player_masters pm ON pm.id = p.player_master_id
WHERE p.name LIKE '%MARTI%APARICIO%'
  OR p.slug LIKE '%MARTI%APARICIO%'
ORDER BY p.season, p.id;

-- Also show ALL master_ids for MARTÍ APARICIO CASAS
SELECT 
  pm.id,
  pm.master_key,
  pm.canonical_slug,
  pm.canonical_name,
  pm.canonical_birth_date,
  COUNT(DISTINCT p.id) as linked_players
FROM public.player_masters pm
LEFT JOIN public.players p ON p.player_master_id = pm.id
WHERE pm.canonical_name LIKE '%MARTI%APARICIO%'
GROUP BY pm.id, pm.master_key, pm.canonical_slug, pm.canonical_name, pm.canonical_birth_date
ORDER BY COUNT(DISTINCT p.id) DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- CRITICAL FIX: build_player_master_key NEVER uses player.id as fallback
-- Root cause: Trigger was passing NEW.id::TEXT, causing masters with UUID keys
-- Solution: Remove player.id dependency completely, use only name/slug
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 0: Fix normalize_identity_token - LOWER BEFORE regex!
-- Bug: Input 'MARTI APARICIO CASAS' (uppercase) → [^a-z0-9]+ matches all uppercase letters → empty string
CREATE OR REPLACE FUNCTION public.normalize_identity_token(raw_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    REGEXP_REPLACE(
      LOWER(unaccent(COALESCE(raw_value, ''))),
      '[^a-z0-9]+',
      '',
      'g'
    ),
    ''
  );
$$;

-- STEP 1: Fix build_player_master_key function - REMOVE player.id usage completely
CREATE OR REPLACE FUNCTION public.build_player_master_key(
  in_slug TEXT,
  in_name TEXT,
  in_birth_date DATE,
  in_fallback TEXT DEFAULT ''  -- Changed: no longer accepts player.id, always empty default
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_slug_key TEXT;
  v_name_key TEXT;
  v_base_key TEXT;
BEGIN
  v_slug_key := public.normalize_identity_token(in_slug);
  v_name_key := public.normalize_identity_token(in_name);
  -- FIXED: Never use player.id - only use slug/name/unknown-player
  v_base_key := COALESCE(v_slug_key, v_name_key, 'unknown-player');

  IF in_birth_date IS NOT NULL THEN
    RETURN v_base_key || '::' || TO_CHAR(in_birth_date, 'YYYYMMDD');
  END IF;

  RETURN v_base_key;
END;
$$;

-- STEP 2: Clear FK constraints to allow master deletion
UPDATE public.players SET player_master_id = NULL;

-- STEP 3: Delete all corrupted masters (those with UUID keys)
DELETE FROM public.player_masters
WHERE master_key LIKE '________-____-____-____-____________::%';  -- UUID pattern match

-- STEP 4: Rebuild correct masters using FIXED function
INSERT INTO public.player_masters (id, master_key, canonical_slug, canonical_name, canonical_birth_date)
SELECT 
  gen_random_uuid(),
  public.build_player_master_key(slug, name, birth_date, ''),
  slug,
  UPPER(COALESCE(NULLIF(BTRIM(name), ''), 'Jugador sense nom')),
  birth_date
FROM (
  SELECT DISTINCT ON (
    public.build_player_master_key(slug, name, birth_date, '')
  )
    slug,
    name,
    birth_date
  FROM public.players
  WHERE name IS NOT NULL
  ORDER BY 
    public.build_player_master_key(slug, name, birth_date, ''),
    name
) AS distinct_identities
ON CONFLICT (master_key) DO NOTHING;

-- STEP 5: Re-link all players to corrected masters
UPDATE public.players p
SET player_master_id = pm.id
FROM public.player_masters pm
WHERE pm.master_key = public.build_player_master_key(p.slug, p.name, p.birth_date, '');

-- STEP 6: Verification queries
SELECT '=== VERIFICATION ===' as section, '' as data;

SELECT 'MARTI masters (should be 1)' as metric, COUNT(DISTINCT id) as count 
FROM public.player_masters 
WHERE canonical_name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'MARTI players (should be 3)', COUNT(*)
FROM public.players
WHERE name LIKE '%MARTI%APARICIO%'
UNION ALL
SELECT 'Total masters (should be ~20000)', COUNT(*)
FROM public.player_masters
UNION ALL
SELECT 'Total players (should be ~46000)', COUNT(*)
FROM public.players
UNION ALL
SELECT 'Players with master_id (should be ~46000)', COUNT(*)
FROM public.players
WHERE player_master_id IS NOT NULL
UNION ALL
SELECT 'Masters with UUID pattern (should be 0)', COUNT(*)
FROM public.player_masters
WHERE master_key LIKE '________-____-____-____-____________::%';

-- Check a sample MARTI master_key (should be martiapariocasas::YYYYMMDD, not UUID)
SELECT 'SAMPLE MARTI MASTER' as info, id, master_key, canonical_name
FROM public.player_masters 
WHERE canonical_name LIKE '%MARTI%APARICIO%'
LIMIT 1;

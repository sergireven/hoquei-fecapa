-- Supabase migration: roles + persistent user location
-- Execute in Supabase SQL editor.

-- 1) Ensure role values support new app roles.
-- Supports both enum and text/varchar role columns.
DO $$
DECLARE
  v_typtype "char";
  v_typname text;
  v_typnsp text;
  v_con record;
BEGIN
  SELECT t.typtype, t.typname, n.nspname
    INTO v_typtype, v_typname, v_typnsp
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE ns.nspname = 'public'
    AND c.relname = 'profiles'
    AND a.attname = 'role'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF NOT FOUND THEN
    RAISE NOTICE 'Column public.profiles.role not found; skipping role migration.';
    RETURN;
  END IF;

  IF v_typtype = 'e' THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', v_typnsp, v_typname, 'coordinador');
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', v_typnsp, v_typname, 'gestor_botiga');
  ELSE
    -- Replace role check constraints so new roles are accepted.
    FOR v_con IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.profiles'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%role%'
    LOOP
      EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', v_con.conname);
    END LOOP;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IS NULL OR role IN ('entrenador', 'coordinador', 'gestor_botiga', 'admin'));
  END IF;
END $$;

-- 2) Add persistent location fields on profiles (if missing).
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_location jsonb;

-- 3) Backfill between scalar and json formats for compatibility.
UPDATE public.profiles
SET
  location_label = COALESCE(location_label, user_location->>'label'),
  location_lat = COALESCE(location_lat, NULLIF(user_location->>'lat', '')::double precision),
  location_lng = COALESCE(location_lng, NULLIF(user_location->>'lng', '')::double precision),
  location_updated_at = COALESCE(location_updated_at, NULLIF(user_location->>'updatedAt', '')::timestamptz)
WHERE user_location IS NOT NULL;

UPDATE public.profiles
SET user_location = jsonb_build_object(
  'label', location_label,
  'lat', location_lat,
  'lng', location_lng,
  'updatedAt', COALESCE(location_updated_at, now())
)
WHERE user_location IS NULL
  AND location_lat IS NOT NULL
  AND location_lng IS NOT NULL;

-- 4) RPC used by frontend to persist location safely.
CREATE OR REPLACE FUNCTION public.update_own_location(
  p_user_id uuid,
  p_location_label text,
  p_location_lat double precision,
  p_location_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.profiles
  SET
    location_label = NULLIF(trim(p_location_label), ''),
    location_lat = p_location_lat,
    location_lng = p_location_lng,
    location_updated_at = now(),
    user_location = jsonb_build_object(
      'label', NULLIF(trim(p_location_label), ''),
      'lat', p_location_lat,
      'lng', p_location_lng,
      'updatedAt', now()
    )
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_location(uuid, text, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_location(uuid, text, double precision, double precision) TO authenticated;

-- 5) Optional sanity checks.
-- SELECT role, count(*) FROM public.profiles GROUP BY role ORDER BY role;
-- SELECT id, role, location_label, location_lat, location_lng FROM public.profiles LIMIT 20;

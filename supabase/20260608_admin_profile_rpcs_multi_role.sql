-- Ensure admin/profile RPCs expose multi-role data consistently.
-- Safe to run multiple times.

DROP FUNCTION IF EXISTS public.get_all_profiles_admin(text);
CREATE OR REPLACE FUNCTION public.get_all_profiles_admin(admin_email text)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  roles text[],
  team_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE lower(p.email) = lower(trim(admin_email))
      AND (
        p.role = 'admin'
        OR COALESCE(p.roles, ARRAY[]::text[]) @> ARRAY['admin']::text[]
      )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.role,
    CASE
      WHEN array_length(COALESCE(p.roles, ARRAY[]::text[]), 1) > 0 THEN p.roles
      WHEN p.role IS NOT NULL AND trim(p.role) <> '' THEN ARRAY[p.role]::text[]
      ELSE ARRAY[]::text[]
    END AS roles,
    p.team_name
  FROM public.profiles p
  ORDER BY lower(p.email);
END;
$$;

DROP FUNCTION IF EXISTS public.get_profile_by_email(text);
CREATE OR REPLACE FUNCTION public.get_profile_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  roles text[],
  team_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.role,
    CASE
      WHEN array_length(COALESCE(p.roles, ARRAY[]::text[]), 1) > 0 THEN p.roles
      WHEN p.role IS NOT NULL AND trim(p.role) <> '' THEN ARRAY[p.role]::text[]
      ELSE ARRAY[]::text[]
    END AS roles,
    p.team_name
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(p_email))
  ORDER BY p.created_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_all_profiles_admin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_profile_by_email(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_all_profiles_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_by_email(text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: function public.update_user_role_admin(text, uuid, text) is not unique
-- Cause: multiple overloaded versions of update_user_role_admin exist in DB.
-- Fix: drop ALL overloads and recreate ONE clean version.
--      Rewrite update_user_roles_admin to be self-contained (no legacy call).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Drop every overload of update_user_role_admin in public schema.
DO $$
DECLARE
  v_sig text;
BEGIN
  FOR v_sig IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'update_user_role_admin'
      AND n.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || v_sig || ' CASCADE';
  END LOOP;
END $$;

-- 2) Recreate a single, unambiguous update_user_role_admin.
CREATE OR REPLACE FUNCTION public.update_user_role_admin(
  admin_email text,
  target_id   uuid,
  new_role    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin check
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.email) = lower(trim(admin_email))
      AND (
        p.role = 'admin'
        OR COALESCE(p.roles, ARRAY[]::text[]) @> ARRAY['admin']::text[]
      )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.profiles
  SET role = nullif(trim(new_role), '')
  WHERE id = target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_role_admin(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_role_admin(text, uuid, text) TO authenticated;

-- 3) Rewrite update_user_roles_admin to be fully self-contained.
--    No longer calls update_user_role_admin internally — avoids any future
--    ambiguity issues and does both role + roles in a single UPDATE.
CREATE OR REPLACE FUNCTION public.update_user_roles_admin(
  admin_email text,
  target_id   uuid,
  new_roles   text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roles   text[];
  v_primary text;
BEGIN
  v_roles   := public.normalize_app_roles(new_roles);
  v_primary := CASE WHEN array_length(v_roles, 1) > 0 THEN v_roles[1] ELSE NULL END;

  -- Admin check
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.email) = lower(trim(admin_email))
      AND (
        p.role = 'admin'
        OR COALESCE(p.roles, ARRAY[]::text[]) @> ARRAY['admin']::text[]
      )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Single UPDATE: sets both scalar role and array roles atomically.
  UPDATE public.profiles
  SET role  = v_primary,
      roles = v_roles
  WHERE id = target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_roles_admin(text, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_roles_admin(text, uuid, text[]) TO authenticated;

-- Supabase migration: multi-role support for one user
-- Keeps backward compatibility with existing single-role columns/RPCs.

CREATE OR REPLACE FUNCTION public.normalize_app_roles(p_roles text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(role), ARRAY[]::text[])
  FROM (
    SELECT DISTINCT lower(trim(v)) AS role
    FROM unnest(COALESCE(p_roles, ARRAY[]::text[])) AS x(v)
    WHERE lower(trim(v)) IN ('entrenador', 'coordinador', 'gestor_botiga', 'admin')
    ORDER BY 1
  ) q;
$$;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS roles text[];

UPDATE public.profiles
SET roles = public.normalize_app_roles(
  CASE
    WHEN roles IS NOT NULL AND array_length(roles, 1) > 0 THEN roles
    WHEN role IS NOT NULL AND trim(role) <> '' THEN ARRAY[role]
    ELSE ARRAY[]::text[]
  END
)
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN roles SET DEFAULT ARRAY[]::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_roles_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_roles_check
      CHECK (
        roles IS NOT NULL
        AND roles <@ ARRAY['entrenador', 'coordinador', 'gestor_botiga', 'admin']::text[]
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_profile_role_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_roles text[];
BEGIN
  v_roles := public.normalize_app_roles(
    CASE
      WHEN NEW.roles IS NOT NULL THEN NEW.roles
      WHEN NEW.role IS NOT NULL AND trim(NEW.role) <> '' THEN ARRAY[NEW.role]
      ELSE ARRAY[]::text[]
    END
  );

  NEW.roles := v_roles;
  NEW.role := CASE WHEN array_length(v_roles, 1) > 0 THEN v_roles[1] ELSE NULL END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_roles ON public.profiles;
CREATE TRIGGER trg_profiles_sync_roles
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_role_columns();

ALTER TABLE IF EXISTS public.pending_roles
  ADD COLUMN IF NOT EXISTS roles text[];

UPDATE public.pending_roles
SET roles = public.normalize_app_roles(
  CASE
    WHEN roles IS NOT NULL AND array_length(roles, 1) > 0 THEN roles
    WHEN role IS NOT NULL AND trim(role) <> '' THEN ARRAY[role]
    ELSE ARRAY[]::text[]
  END
)
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

ALTER TABLE public.pending_roles
  ALTER COLUMN roles SET DEFAULT ARRAY[]::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.pending_roles'::regclass
      AND conname = 'pending_roles_roles_check'
  ) THEN
    ALTER TABLE public.pending_roles
      ADD CONSTRAINT pending_roles_roles_check
      CHECK (
        roles IS NOT NULL
        AND roles <@ ARRAY['entrenador', 'coordinador', 'gestor_botiga', 'admin']::text[]
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_pending_role_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_roles text[];
BEGIN
  v_roles := public.normalize_app_roles(
    CASE
      WHEN NEW.roles IS NOT NULL THEN NEW.roles
      WHEN NEW.role IS NOT NULL AND trim(NEW.role) <> '' THEN ARRAY[NEW.role]
      ELSE ARRAY[]::text[]
    END
  );

  NEW.roles := v_roles;
  NEW.role := CASE WHEN array_length(v_roles, 1) > 0 THEN v_roles[1] ELSE NULL END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_roles_sync_roles ON public.pending_roles;
CREATE TRIGGER trg_pending_roles_sync_roles
BEFORE INSERT OR UPDATE ON public.pending_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_pending_role_columns();

CREATE OR REPLACE FUNCTION public.update_user_roles_admin(
  admin_email text,
  target_id uuid,
  new_roles text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roles text[];
  v_primary text;
BEGIN
  v_roles := public.normalize_app_roles(new_roles);
  v_primary := CASE WHEN array_length(v_roles, 1) > 0 THEN v_roles[1] ELSE NULL END;

  IF to_regprocedure('public.update_user_role_admin(text,uuid,text)') IS NOT NULL THEN
    PERFORM public.update_user_role_admin(admin_email, target_id, v_primary);
  ELSE
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

    UPDATE public.profiles p
    SET role = v_primary
    WHERE p.id = target_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'target_not_found';
    END IF;
  END IF;

  UPDATE public.profiles p
  SET roles = v_roles
  WHERE p.id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_manage_user_roles(
  admin_email text,
  p_email text,
  p_roles text[],
  p_team text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roles text[];
  v_primary text;
BEGIN
  v_roles := public.normalize_app_roles(p_roles);
  v_primary := CASE WHEN array_length(v_roles, 1) > 0 THEN v_roles[1] ELSE NULL END;

  IF to_regprocedure('public.admin_manage_user(text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'admin_manage_user_not_found';
  END IF;

  PERFORM public.admin_manage_user(admin_email, p_email, v_primary, p_team);

  UPDATE public.profiles
  SET roles = v_roles
  WHERE lower(email) = lower(trim(p_email));

  UPDATE public.pending_roles
  SET roles = v_roles
  WHERE lower(email) = lower(trim(p_email));
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_pending_role_row_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row jsonb;
  v_email text;
  v_role text;
  v_roles text[];
  v_team text;
  v_uid uuid;
  v_auth_email text;
BEGIN
  v_row := to_jsonb(NEW);
  v_email := lower(trim(coalesce(v_row->>'email', '')));
  v_roles := public.normalize_app_roles(COALESCE(NEW.roles, ARRAY[coalesce(v_row->>'role', '')]::text[]));
  v_role := CASE WHEN array_length(v_roles, 1) > 0 THEN v_roles[1] ELSE nullif(trim(coalesce(v_row->>'role', '')), '') END;
  v_team := nullif(trim(coalesce(v_row->>'team_name', v_row->>'team', '')), '');

  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  SELECT u.id, u.email
    INTO v_uid, v_auth_email
  FROM auth.users u
  WHERE lower(u.email) = v_email
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, role, roles, team_name)
  VALUES (v_uid, v_auth_email, v_role, v_roles, v_team)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    roles = EXCLUDED.roles,
    team_name = COALESCE(EXCLUDED.team_name, public.profiles.team_name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_roles_sync_profile ON public.pending_roles;
CREATE TRIGGER trg_pending_roles_sync_profile
AFTER INSERT OR UPDATE ON public.pending_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_pending_role_row_to_profile();

REVOKE ALL ON FUNCTION public.normalize_app_roles(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_role_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_pending_role_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_roles_admin(text, uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_manage_user_roles(text, text, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_pending_role_row_to_profile() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.normalize_app_roles(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_user_roles_admin(text, uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_manage_user_roles(text, text, text[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_pending_role_row_to_profile() TO authenticated, service_role;

-- Optional checks:
-- SELECT email, role, roles FROM public.profiles ORDER BY email LIMIT 50;
-- SELECT email, role, roles FROM public.pending_roles ORDER BY email LIMIT 50;

-- Supabase migration: auto-sync pending_roles -> profiles when auth user already exists
-- Goal: when admin adds/updates a pending role, create/update profile immediately
-- if that email already exists in auth.users.

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
  v_team text;
  v_uid uuid;
  v_auth_email text;
BEGIN
  v_row := to_jsonb(NEW);
  v_email := lower(trim(coalesce(v_row->>'email', '')));
  v_role := nullif(trim(coalesce(v_row->>'role', '')), '');
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
    -- Keep pending role for future signup/login flows.
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, role, team_name)
  VALUES (v_uid, v_auth_email, v_role, v_team)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    team_name = COALESCE(EXCLUDED.team_name, public.profiles.team_name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_roles_sync_profile ON public.pending_roles;
CREATE TRIGGER trg_pending_roles_sync_profile
AFTER INSERT OR UPDATE ON public.pending_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_pending_role_row_to_profile();

-- One-time backfill for existing pending_roles rows that already have auth user.
DO $$
DECLARE
  rec record;
  v_row jsonb;
  v_email text;
  v_role text;
  v_team text;
  v_uid uuid;
  v_auth_email text;
BEGIN
  FOR rec IN SELECT to_jsonb(pr) AS row_data FROM public.pending_roles pr LOOP
    v_row := rec.row_data;
    v_email := lower(trim(coalesce(v_row->>'email', '')));
    v_role := nullif(trim(coalesce(v_row->>'role', '')), '');
    v_team := nullif(trim(coalesce(v_row->>'team_name', v_row->>'team', '')), '');

    IF v_email = '' THEN
      CONTINUE;
    END IF;

    SELECT u.id, u.email
      INTO v_uid, v_auth_email
    FROM auth.users u
    WHERE lower(u.email) = v_email
    ORDER BY u.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    INSERT INTO public.profiles (id, email, role, team_name)
    VALUES (v_uid, v_auth_email, v_role, v_team)
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      team_name = COALESCE(EXCLUDED.team_name, public.profiles.team_name);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.sync_pending_role_row_to_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_pending_role_row_to_profile() TO authenticated, service_role;

-- Optional verification queries:
-- SELECT p.id, p.email, p.role, p.team_name
-- FROM public.profiles p
-- WHERE lower(p.email) IN (SELECT lower(email) FROM public.pending_roles)
-- ORDER BY p.email;

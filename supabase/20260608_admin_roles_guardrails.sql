-- Guardrails for admin role management: never allow empty role sets.

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

  IF array_length(v_roles, 1) IS NULL OR array_length(v_roles, 1) = 0 THEN
    RAISE EXCEPTION 'at_least_one_role_required';
  END IF;

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

  IF array_length(v_roles, 1) IS NULL OR array_length(v_roles, 1) = 0 THEN
    RAISE EXCEPTION 'at_least_one_role_required';
  END IF;

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

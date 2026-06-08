-- Fix pending_roles/profiles sync triggers when roles has default '{}'.
--
-- Root cause:
-- The previous trigger logic preferred NEW.roles whenever it was non-NULL.
-- With roles defaulting to an empty array, legacy writes that only sent NEW.role
-- were converted to roles={} and role=NULL, which breaks schemas where role is NOT NULL.

CREATE OR REPLACE FUNCTION public.sync_profile_role_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_roles text[];
BEGIN
  v_roles := public.normalize_app_roles(
    CASE
      WHEN NEW.roles IS NOT NULL AND array_length(NEW.roles, 1) > 0 THEN NEW.roles
      WHEN NEW.role IS NOT NULL AND trim(NEW.role) <> '' THEN ARRAY[NEW.role]
      ELSE ARRAY[]::text[]
    END
  );

  NEW.roles := v_roles;
  NEW.role := CASE WHEN array_length(v_roles, 1) > 0 THEN v_roles[1] ELSE NULL END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_pending_role_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_roles text[];
BEGIN
  v_roles := public.normalize_app_roles(
    CASE
      WHEN NEW.roles IS NOT NULL AND array_length(NEW.roles, 1) > 0 THEN NEW.roles
      WHEN NEW.role IS NOT NULL AND trim(NEW.role) <> '' THEN ARRAY[NEW.role]
      ELSE ARRAY[]::text[]
    END
  );

  NEW.roles := v_roles;
  NEW.role := CASE WHEN array_length(v_roles, 1) > 0 THEN v_roles[1] ELSE NULL END;
  RETURN NEW;
END;
$$;

-- Backfill legacy rows where role is empty but roles already has values.
UPDATE public.pending_roles
SET role = (
  CASE
    WHEN array_length(public.normalize_app_roles(roles), 1) > 0
      THEN (public.normalize_app_roles(roles))[1]
    ELSE NULL
  END
)
WHERE (role IS NULL OR trim(role) = '')
  AND array_length(public.normalize_app_roles(roles), 1) > 0;

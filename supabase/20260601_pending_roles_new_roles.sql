-- Supabase migration: allow new roles in pending_roles
-- Execute after 20260529_roles_and_location.sql if that migration was already applied.

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
    AND c.relname = 'pending_roles'
    AND a.attname = 'role'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF NOT FOUND THEN
    RAISE NOTICE 'Column public.pending_roles.role not found; skipping pending_roles role migration.';
    RETURN;
  END IF;

  IF v_typtype = 'e' THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', v_typnsp, v_typname, 'coordinador');
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', v_typnsp, v_typname, 'gestor_botiga');
  ELSE
    FOR v_con IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.pending_roles'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%role%'
    LOOP
      EXECUTE format('ALTER TABLE public.pending_roles DROP CONSTRAINT IF EXISTS %I', v_con.conname);
    END LOOP;

    ALTER TABLE public.pending_roles
      ADD CONSTRAINT pending_roles_role_check
      CHECK (role IS NULL OR role IN ('entrenador', 'coordinador', 'gestor_botiga', 'admin'));
  END IF;
END $$;

-- Optional verification
-- SELECT role, count(*) FROM public.pending_roles GROUP BY role ORDER BY role;

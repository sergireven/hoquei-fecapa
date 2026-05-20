-- okCat360 - Supabase fixes
-- Executa al SQL Editor de Supabase

-- 1. FIX BUCLE INFINIT A PROFILES RLS

create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists(
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
$$;

drop policy if exists "admin actualitza rols" on public.profiles;
drop policy if exists "admin llegeix tot"     on public.profiles;
drop policy if exists "lectura pròpia"        on public.profiles;

create policy "admin llegeix tot"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "admin actualitza rols"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());


-- 2. AFEGIR 'level' AL CHECK CONSTRAINT DE user_favorites

alter table public.user_favorites
  drop constraint if exists user_favorites_fav_type_check;

alter table public.user_favorites
  add constraint user_favorites_fav_type_check
  check (fav_type = any(array['team','player','club','level']));


-- 3. FUNCIONS RPC AMB ELS NOMS DE COLUMNES CORRECTES

create or replace function public.upsert_user_favorite(
  p_user_id uuid,
  p_type    text,
  p_key     text,
  p_data    jsonb
) returns void language plpgsql security definer as $$
begin
  delete from public.user_favorites
    where profile_id = p_user_id and type = p_type and fav_key = p_key;
  insert into public.user_favorites(profile_id, user_id, type, fav_type, fav_key, data, fav_data, updated_at)
  values (p_user_id, p_user_id, p_type, p_type, p_key, p_data, p_data, now());
end;
$$;

create or replace function public.delete_user_favorite(
  p_user_id uuid,
  p_type    text,
  p_key     text
) returns void language sql security definer as $$
  delete from public.user_favorites
  where profile_id = p_user_id and type = p_type and fav_key = p_key;
$$;

create or replace function public.update_own_team_name(
  p_user_id   uuid,
  p_team_name text
) returns void language sql security definer as $$
  update public.profiles set team_name = p_team_name where id = p_user_id;
$$;

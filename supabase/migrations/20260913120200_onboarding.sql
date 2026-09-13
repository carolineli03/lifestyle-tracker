-- ---------------------------------------------------------------------------
-- Icebox: onboarding
--
-- Sign-up gives you a profile row and nothing else. The first screen after
-- authentication asks one question — start a kitchen, or join one with a code
-- — and calls one of the two RPCs below. Both are SECURITY DEFINER because
-- they have to write rows that the caller's own RLS policies would refuse
-- (you cannot insert yourself into a household you cannot yet see).
-- ---------------------------------------------------------------------------

-- --- profile row on sign-up ------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- create a household ----------------------------------------------------

create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_household public.households;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    raise exception 'You are already in a household.' using errcode = '23505';
  end if;

  insert into public.households (name)
  values (coalesce(nullif(trim(p_name), ''), 'Our kitchen'))
  returning * into v_household;

  insert into public.household_members (household_id, user_id, role)
  values (v_household.id, v_uid, 'owner');

  return v_household;
end;
$$;

-- --- join an existing household -------------------------------------------

create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_household public.households;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_household
  from public.households h
  where upper(h.join_code) = upper(trim(p_code));

  if v_household.id is null then
    raise exception 'That code does not match any household.' using errcode = 'P0002';
  end if;

  -- Already a member: treat as success so a double tap is harmless.
  if exists (
    select 1 from public.household_members m
    where m.household_id = v_household.id and m.user_id = v_uid
  ) then
    return v_household;
  end if;

  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    raise exception 'You are already in a household. Leave it before joining another.'
      using errcode = '23505';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_household.id, v_uid, 'member');

  return v_household;
end;
$$;

revoke all on function public.create_household(text) from public;
revoke all on function public.join_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

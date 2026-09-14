-- ---------------------------------------------------------------------------
-- Lifestyle Tracker: remember a new food per serving, not per plateful
--
-- log_entry used one set of macros for both writes. The entry correctly gets
-- what was eaten, but a food seen for the first time was also saved to the
-- library with that total. Log 2 servings of Greek yogurt and the library
-- would remember one serving as 260 kcal. Photo logging made it worse: the
-- label gives per-serving numbers, and you then say how many you had.
--
-- The new optional p_serving_* parameters carry the single-serving macros.
-- They're used only when the food is created. As before, an existing library
-- row is never overwritten. Callers that don't pass them get the old
-- behaviour.
--
-- The signature changes, so the old function is dropped rather than
-- overloaded: two log_entry functions would make PostgREST's RPC call
-- ambiguous.
-- ---------------------------------------------------------------------------

drop function if exists public.log_entry(text, integer, numeric, numeric, numeric, date, boolean);
-- Safe to re-run: replace this migration's own signature too, if it's already there.
drop function if exists public.log_entry(text, integer, numeric, numeric, numeric, date, boolean, integer, numeric, numeric, numeric);

create function public.log_entry(
  p_name              text,
  p_kcal              integer,
  p_protein_g         numeric,
  p_carb_g            numeric,
  p_fat_g             numeric,
  p_logged_on         date default null,
  p_remember          boolean default true,
  p_serving_kcal      integer default null,
  p_serving_protein_g numeric default null,
  p_serving_carb_g    numeric default null,
  p_serving_fat_g     numeric default null
)
returns public.entries
language plpgsql
set search_path = public
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_household uuid := public.current_household_id();
  v_name      text := nullif(trim(p_name), '');
  v_food_id   uuid;
  v_entry     public.entries;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_name is null then
    raise exception 'A food needs a name.' using errcode = '22023';
  end if;

  -- Remember the food for next time, as ONE serving. On a name collision bump
  -- the counter and leave the stored macros alone: the library row is the
  -- canonical serving.
  if p_remember and v_household is not null then
    insert into public.foods (
      household_id, name, kcal, protein_g, carb_g, fat_g, times_logged, last_logged_at
    )
    values (
      v_household, v_name,
      greatest(coalesce(p_serving_kcal, p_kcal, 0), 0),
      greatest(coalesce(p_serving_protein_g, p_protein_g, 0), 0),
      greatest(coalesce(p_serving_carb_g, p_carb_g, 0), 0),
      greatest(coalesce(p_serving_fat_g, p_fat_g, 0), 0),
      1, now()
    )
    on conflict (household_id, lower(trim(name)))
    do update set
      times_logged   = public.foods.times_logged + 1,
      last_logged_at = now()
    returning id into v_food_id;
  end if;

  insert into public.entries (
    user_id, logged_on, name, kcal, protein_g, carb_g, fat_g, food_id
  )
  values (
    v_uid,
    coalesce(p_logged_on, current_date),
    v_name,
    greatest(coalesce(p_kcal, 0), 0),
    greatest(coalesce(p_protein_g, 0), 0),
    greatest(coalesce(p_carb_g, 0), 0),
    greatest(coalesce(p_fat_g, 0), 0),
    v_food_id
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function public.log_entry(text, integer, numeric, numeric, numeric, date, boolean, integer, numeric, numeric, numeric) from public;
grant execute on function public.log_entry(text, integer, numeric, numeric, numeric, date, boolean, integer, numeric, numeric, numeric) to authenticated;

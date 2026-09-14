-- ---------------------------------------------------------------------------
-- Lifestyle Tracker: logging a food
--
-- Confirming an entry does two writes that must not drift apart: the entry
-- itself, and an upsert into the household's food library so the library
-- builds itself out of what actually gets eaten. Doing that from the client
-- would be two round trips with a window in between, and the dedupe key is a
-- functional index — lower(trim(name)) — which PostgREST's upsert cannot
-- target. So it lives here, in one statement pair, in one transaction.
--
-- SECURITY INVOKER (the default) on purpose: RLS still applies, so this
-- function can only ever write a row the caller was already allowed to write.
-- ---------------------------------------------------------------------------

create or replace function public.log_entry(
  p_name       text,
  p_kcal       integer,
  p_protein_g  numeric,
  p_carb_g     numeric,
  p_fat_g      numeric,
  p_logged_on  date default null,
  p_remember   boolean default true
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

  -- Remember the food for next time. On a name collision we bump the counter
  -- and leave the stored macros alone: the library row is the canonical
  -- portion, and today's entry may well have been half of it.
  if p_remember and v_household is not null then
    insert into public.foods (
      household_id, name, kcal, protein_g, carb_g, fat_g, times_logged, last_logged_at
    )
    values (
      v_household, v_name,
      greatest(coalesce(p_kcal, 0), 0),
      greatest(coalesce(p_protein_g, 0), 0),
      greatest(coalesce(p_carb_g, 0), 0),
      greatest(coalesce(p_fat_g, 0), 0),
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

revoke all on function public.log_entry(text, integer, numeric, numeric, numeric, date, boolean) from public;
grant execute on function public.log_entry(text, integer, numeric, numeric, numeric, date, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Lifestyle Tracker: the shopping list
--
-- Kept separate from pantry_items rather than added as a `needed` flag on it.
-- The two are different kinds of thing: a pantry item is something you own,
-- and it has a location and a use-by date. Something you have not bought yet
-- has neither, and folding them into one table would mean every inventory
-- query carrying a filter it could forget.
--
-- Household-scoped, like the rest of the kitchen: either person adds to it,
-- either person shops from it.
-- ---------------------------------------------------------------------------

create table public.shopping_list (
  household_id uuid not null references public.households (id) on delete cascade,
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 120),
  -- Free text, same reasoning as pantry_items.quantity: "2 lb", "whatever
  -- looks good", "the big jar".
  note         text,
  done         boolean not null default false,
  added_by     uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  done_at      timestamptz
);

create index shopping_list_household_idx
  on public.shopping_list (household_id, done, created_at desc);

-- Adding the same thing twice is a nuisance, not an error, so dedupe the
-- outstanding items case-insensitively. Ticked-off rows are excluded: buying
-- milk in March should not block adding milk in April.
create unique index shopping_list_open_name_key
  on public.shopping_list (household_id, lower(trim(name)))
  where done = false;

alter table public.shopping_list enable row level security;

create policy "the shopping list is shared within the household"
  on public.shopping_list for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Putting the shopping away
--
-- Ticking an item off after a shop should land it in the kitchen with a
-- location and a use-by date. That is two writes — insert the pantry item,
-- retire the list row — and they must not half-happen, or you end up with
-- groceries that are both still on the list and already in the fridge.
--
-- SECURITY INVOKER: RLS still decides whether the caller may touch either row.
-- ---------------------------------------------------------------------------

create or replace function public.stock_shopping_item(
  p_id         uuid,
  p_quantity   text default null,
  p_location   public.storage_location default 'fridge',
  p_expires_on date default null
)
returns public.pantry_items
language plpgsql
set search_path = public
as $$
declare
  v_item  public.shopping_list;
  v_entry public.pantry_items;
begin
  select * into v_item from public.shopping_list where id = p_id;

  if v_item.id is null then
    raise exception 'That item is no longer on the list.' using errcode = 'P0002';
  end if;

  insert into public.pantry_items (household_id, name, quantity, location, expires_on, created_by)
  values (
    v_item.household_id,
    v_item.name,
    nullif(trim(coalesce(p_quantity, '')), ''),
    p_location,
    p_expires_on,
    (select auth.uid())
  )
  returning * into v_entry;

  delete from public.shopping_list where id = p_id;

  return v_entry;
end;
$$;

revoke all on function public.stock_shopping_item(uuid, text, public.storage_location, date) from public;
grant execute on function public.stock_shopping_item(uuid, text, public.storage_location, date) to authenticated;

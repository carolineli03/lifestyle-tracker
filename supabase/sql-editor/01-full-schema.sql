-- Lifestyle Tracker: full schema, generated 2026-09-13 from supabase/migrations (in order).
-- Paste into Supabase dashboard -> SQL Editor -> New query, then Run.
-- Runs as one transaction: if any statement fails, nothing is applied.

begin;

-- ===========================================================================
-- 20260913120000_initial_schema.sql
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Lifestyle Tracker: initial schema
--
-- Two sharing boundaries exist in this app and it is worth being explicit
-- about them up front, because every RLS policy in the next migration is a
-- restatement of one of these two sentences:
--
--   * HOUSEHOLD-SCOPED (shared): pantry_items, foods. Both people who share a
--     kitchen see the same fridge and the same food library.
--   * USER-SCOPED (private): profiles, entries, movement, weigh_ins, ai_usage.
--     Sharing a kitchen does not mean sharing a weight log.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto" with schema extensions;

-- --- enums -----------------------------------------------------------------

create type public.storage_location as enum ('fridge', 'freezer', 'pantry');
create type public.household_role  as enum ('owner', 'member');
create type public.sex_at_birth    as enum ('female', 'male');

-- --- households ------------------------------------------------------------

-- Short, human-typeable join code. The alphabet deliberately omits I, L, O, 0
-- and 1 so a code read aloud in a kitchen is not ambiguous.
create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.households h where h.join_code = code);
  end loop;
  return code;
end;
$$;

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 80),
  join_code  text not null unique default public.generate_join_code(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.household_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);

-- --- profiles --------------------------------------------------------------

-- One row per user. Everything except user_id is nullable: a profile exists
-- from the moment you sign up, but targets only appear once you have run the
-- calculator on the Progress tab.
create table public.profiles (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  sex_at_birth         public.sex_at_birth,
  age                  integer check (age between 13 and 120),
  height_inches        numeric(5, 2) check (height_inches between 36 and 96),
  activity_factor      numeric(4, 3) check (activity_factor between 1 and 2.5),
  target_rate_lb_week  numeric(3, 2) check (target_rate_lb_week between 0 and 3),
  kcal_target          integer check (kcal_target between 0 and 10000),
  protein_target       integer check (protein_target >= 0),
  carb_target          integer check (carb_target >= 0),
  fat_target           integer check (fat_target >= 0),
  start_weight         numeric(6, 2) check (start_weight > 0),
  goal_weight          numeric(6, 2) check (goal_weight > 0),
  goal_date            date,
  weekly_movement_goal integer check (weekly_movement_goal between 0 and 10000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- --- kitchen (household-scoped) -------------------------------------------

create table public.pantry_items (
  household_id uuid not null references public.households (id) on delete cascade,
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 120),
  -- Free text on purpose: "2 lb", "half a bunch", "3 cans". Quantities in a
  -- real kitchen do not fit in a numeric column.
  quantity     text,
  location     public.storage_location not null default 'fridge',
  expires_on   date,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Drives the Fridge tab's default ordering: soonest-expiring first, with
-- undated items last.
create index pantry_items_household_expiry_idx
  on public.pantry_items (household_id, expires_on nulls last);

-- Our own food database, built up from what actually gets logged.
create table public.foods (
  household_id  uuid not null references public.households (id) on delete cascade,
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) between 1 and 120),
  kcal          integer not null default 0 check (kcal >= 0),
  protein_g     numeric(7, 2) not null default 0 check (protein_g >= 0),
  carb_g        numeric(7, 2) not null default 0 check (carb_g >= 0),
  fat_g         numeric(7, 2) not null default 0 check (fat_g >= 0),
  times_logged  integer not null default 0 check (times_logged >= 0),
  last_logged_at timestamptz,
  created_at    timestamptz not null default now()
);

-- Case-insensitive dedupe key. "Greek yogurt" and "greek yogurt" are the same
-- food; the upsert on confirm relies on this index.
create unique index foods_household_name_key
  on public.foods (household_id, lower(trim(name)));

-- Search-as-you-type on the Today tab orders by times_logged desc.
create index foods_household_times_logged_idx
  on public.foods (household_id, times_logged desc);

-- --- logs (user-scoped, private) ------------------------------------------

create table public.entries (
  user_id    uuid not null references auth.users (id) on delete cascade,
  id         uuid primary key default gen_random_uuid(),
  logged_on  date not null default current_date,
  name       text not null check (length(trim(name)) between 1 and 200),
  kcal       integer not null default 0 check (kcal >= 0),
  protein_g  numeric(7, 2) not null default 0 check (protein_g >= 0),
  carb_g     numeric(7, 2) not null default 0 check (carb_g >= 0),
  fat_g      numeric(7, 2) not null default 0 check (fat_g >= 0),
  -- Nullable: an entry keeps its own copy of the macros, so deleting the food
  -- from the library must not rewrite history.
  food_id    uuid references public.foods (id) on delete set null,
  created_at timestamptz not null default now()
);

create index entries_user_day_idx on public.entries (user_id, logged_on desc);

create table public.movement (
  user_id    uuid not null references auth.users (id) on delete cascade,
  id         uuid primary key default gen_random_uuid(),
  logged_on  date not null default current_date,
  kind       text not null check (length(trim(kind)) between 1 and 60),
  minutes    integer not null check (minutes between 1 and 1440),
  created_at timestamptz not null default now()
);

create index movement_user_day_idx on public.movement (user_id, logged_on desc);

create table public.weigh_ins (
  user_id    uuid not null references auth.users (id) on delete cascade,
  id         uuid primary key default gen_random_uuid(),
  logged_on  date not null default current_date,
  weight_lb  numeric(6, 2) not null check (weight_lb between 40 and 1200),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index weigh_ins_user_day_idx on public.weigh_ins (user_id, logged_on);

-- --- AI usage --------------------------------------------------------------

-- Doubles as the per-user rate-limit window and the monthly cost log, so the
-- Anthropic spend is answerable with one query instead of a dashboard visit.
create table public.ai_usage (
  user_id       uuid not null references auth.users (id) on delete cascade,
  id            uuid primary key default gen_random_uuid(),
  route         text not null,
  model         text not null,
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  ok            boolean not null default true,
  created_at    timestamptz not null default now()
);

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);


-- ===========================================================================
-- 20260913120100_rls_policies.sql
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Lifestyle Tracker: Row Level Security
--
-- Every table gets RLS enabled and explicit policies. There is no "allow all"
-- fallback anywhere: a table with RLS on and no matching policy denies by
-- default, which is the behaviour we want if a future migration forgets one.
--
-- The membership lookup lives in SECURITY DEFINER helpers. That is not an
-- optimisation, it is a correctness requirement: a policy on
-- household_members that itself selected from household_members would recurse
-- forever. The helpers run as the table owner, so they see the whole table and
-- the recursion never starts.
-- ---------------------------------------------------------------------------

-- --- membership helpers ----------------------------------------------------

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
  );
$$;

comment on function public.is_household_member(uuid) is
  'True when the calling user belongs to the given household. SECURITY DEFINER to avoid RLS recursion on household_members.';

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.household_id
  from public.household_members m
  where m.user_id = (select auth.uid())
  order by m.created_at
  limit 1;
$$;

comment on function public.current_household_id() is
  'The calling user''s active household (their earliest membership). The app assumes one household per person.';

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.current_household_id() from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.current_household_id() to authenticated;

-- --- enable RLS everywhere -------------------------------------------------

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.profiles          enable row level security;
alter table public.pantry_items      enable row level security;
alter table public.foods             enable row level security;
alter table public.entries           enable row level security;
alter table public.movement          enable row level security;
alter table public.weigh_ins         enable row level security;
alter table public.ai_usage          enable row level security;

-- ---------------------------------------------------------------------------
-- households: readable by its members. Creation and joining go through the
-- SECURITY DEFINER RPCs in the next migration, so there is no INSERT policy
-- here on purpose — a client cannot conjure a household directly.
-- ---------------------------------------------------------------------------

create policy "households are readable by members"
  on public.households for select to authenticated
  using (public.is_household_member(id));

create policy "households are renameable by their owner"
  on public.households for update to authenticated
  using (
    exists (
      select 1 from public.household_members m
      where m.household_id = households.id
        and m.user_id = (select auth.uid())
        and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.household_members m
      where m.household_id = households.id
        and m.user_id = (select auth.uid())
        and m.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- household_members: you can see who shares your kitchen, and you can leave.
-- Adding a member happens only through join_household().
-- ---------------------------------------------------------------------------

create policy "members are visible to the household"
  on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

create policy "you can remove your own membership"
  on public.household_members for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- PRIVATE TABLES
-- profiles, entries, movement, weigh_ins, ai_usage are scoped to the single
-- user who owns the row. Being in the same household grants nothing here.
-- This is what keeps one person's weight log out of the other person's app.
-- ---------------------------------------------------------------------------

create policy "profiles are private"
  on public.profiles for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "entries are private"
  on public.entries for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "movement is private"
  on public.movement for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "weigh_ins are private"
  on public.weigh_ins for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "ai usage is private"
  on public.ai_usage for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- SHARED TABLES
-- pantry_items and foods are the shared kitchen: anyone in the household can
-- read and write them.
-- ---------------------------------------------------------------------------

create policy "pantry is shared within the household"
  on public.pantry_items for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "foods are shared within the household"
  on public.foods for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));


-- ===========================================================================
-- 20260913120200_onboarding.sql
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Lifestyle Tracker: onboarding
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


-- ===========================================================================
-- 20260913130000_log_entry.sql
-- ===========================================================================
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


-- ===========================================================================
-- 20260913140000_shopping_list.sql
-- ===========================================================================
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


-- ===========================================================================
-- 20260913150000_profile_start_date.sql
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Lifestyle Tracker: profile start date
--
-- The Progress chart draws a straight goal-pace line from (start date, start
-- weight) to (goal date, goal weight). start_weight already lived here; its
-- date did not. Stored explicitly rather than inferred from the earliest
-- weigh-in, so deleting or back-filling an old weigh-in cannot quietly move
-- the line.
--
-- No policy change: "profiles are private" covers every column on the row.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column start_date date;

alter table public.profiles
  add constraint profiles_goal_after_start
  check (start_date is null or goal_date is null or goal_date > start_date);

commit;

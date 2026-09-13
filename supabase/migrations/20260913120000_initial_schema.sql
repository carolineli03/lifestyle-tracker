-- ---------------------------------------------------------------------------
-- Icebox: initial schema
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

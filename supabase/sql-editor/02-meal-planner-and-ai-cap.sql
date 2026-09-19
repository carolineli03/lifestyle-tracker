-- Lifestyle Tracker: meal planner + app-wide AI cap. Generated 2026-09-13 from supabase/migrations.
-- Paste into Supabase dashboard -> SQL Editor -> New query, then Run. One transaction: all or nothing.

begin;

-- ===== 20260913160000_meal_planner.sql =====
-- ---------------------------------------------------------------------------
-- Lifestyle Tracker: recipes and the weekly meal plan
--
-- Both are household-shared, like the fridge: either person saves a recipe,
-- either person plans the week.
--
-- A plan row is one meal slot on one day. It is either
--   * cooked that day    — leftovers_from is null, or
--   * eaten as leftovers — leftovers_from points at the cooked row.
-- "How much to make" is the cooked row's eaters plus the eaters of every row
-- that points at it. That sum is computed in the app, not stored, so changing
-- who eats on Tuesday can never leave Sunday's count stale.
-- ---------------------------------------------------------------------------

create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');

create table public.recipes (
  household_id uuid not null references public.households (id) on delete cascade,
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 120),
  -- What the recipe as written makes. Portions to cook are compared to this.
  servings     numeric(5, 2) not null default 1 check (servings > 0 and servings <= 100),
  -- Free lines ("2 lb chicken thighs"). Nothing parses quantities out of them.
  ingredients  text[] not null default '{}',
  method       text check (method is null or length(method) <= 8000),
  kcal         numeric(7, 1) check (kcal is null or kcal >= 0),
  protein_g    numeric(6, 1) check (protein_g is null or protein_g >= 0),
  carb_g       numeric(6, 1) check (carb_g is null or carb_g >= 0),
  fat_g        numeric(6, 1) check (fat_g is null or fat_g >= 0),
  source       text not null default 'manual' check (source in ('manual', 'idea', 'import')),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  -- Lets meal_plan reference (household_id, id), so a plan can never point at
  -- another kitchen's recipe.
  unique (household_id, id)
);

-- Saving the same idea twice should be refused, not quietly duplicated.
create unique index recipes_household_name_key
  on public.recipes (household_id, lower(trim(name)));

create table public.meal_plan (
  household_id   uuid not null references public.households (id) on delete cascade,
  id             uuid primary key default gen_random_uuid(),
  planned_on     date not null,
  meal           public.meal_slot not null,
  recipe_id      uuid not null,
  eaters         integer not null default 2 check (eaters between 1 and 20),
  leftovers_from uuid,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, planned_on, meal),
  foreign key (household_id, recipe_id)
    references public.recipes (household_id, id) on delete cascade,
  -- MATCH SIMPLE: a null leftovers_from (a cooked row) skips the check.
  foreign key (household_id, leftovers_from)
    references public.meal_plan (household_id, id) on delete cascade,
  check (leftovers_from is null or leftovers_from <> id)
);

create index meal_plan_week_idx on public.meal_plan (household_id, planned_on);
create index meal_plan_leftovers_idx on public.meal_plan (leftovers_from) where leftovers_from is not null;

-- ---------------------------------------------------------------------------
-- Leftovers have to make sense: they come from a meal that was actually
-- cooked (not from other leftovers), the same recipe, and within four days
-- after it — the usual fridge limit for cooked food. A check constraint can't
-- look at another row, so this is a trigger. SECURITY INVOKER: it reads the
-- source row through the caller's own RLS, which is the same household.
-- ---------------------------------------------------------------------------

create or replace function public.check_meal_plan_leftovers()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_source public.meal_plan;
begin
  if new.leftovers_from is null then
    return new;
  end if;

  select * into v_source from public.meal_plan where id = new.leftovers_from;

  if v_source.id is null then
    raise exception 'The cooked meal these leftovers come from no longer exists.' using errcode = '23503';
  end if;
  if v_source.leftovers_from is not null then
    raise exception 'Leftovers have to come from a meal that is cooked, not from other leftovers.' using errcode = '23514';
  end if;
  if new.recipe_id <> v_source.recipe_id then
    raise exception 'Leftovers must be the same recipe as the meal they come from.' using errcode = '23514';
  end if;
  if new.planned_on < v_source.planned_on or new.planned_on > v_source.planned_on + 4 then
    raise exception 'Leftovers need to be eaten within four days of cooking.' using errcode = '23514';
  end if;
  if new.planned_on = v_source.planned_on and new.meal = v_source.meal then
    raise exception 'Leftovers can''t be the same meal they were cooked for.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger meal_plan_leftovers_check
  before insert or update on public.meal_plan
  for each row execute function public.check_meal_plan_leftovers();

-- ---------------------------------------------------------------------------
-- RLS: shared within the household, same shape as the fridge and the list.
-- ---------------------------------------------------------------------------

alter table public.recipes   enable row level security;
alter table public.meal_plan enable row level security;

create policy "recipes are shared within the household"
  on public.recipes for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "the meal plan is shared within the household"
  on public.meal_plan for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));


-- ===== 20260913160100_ai_global_cap.sql =====
-- ---------------------------------------------------------------------------
-- Lifestyle Tracker: a whole-app AI spending cap
--
-- With guest accounts, anyone who has the URL gets a fresh account, so the
-- per-person hourly limit alone can't protect the Anthropic bill. The runner
-- also checks how many AI calls the whole app has made today.
--
-- ai_usage is private per user under RLS, so that total needs a SECURITY
-- DEFINER function. It returns a single count and nothing else: no user ids,
-- no routes, no token numbers.
-- ---------------------------------------------------------------------------

create or replace function public.ai_calls_since(p_since timestamptz)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.ai_usage where created_at >= p_since;
$$;

revoke all on function public.ai_calls_since(timestamptz) from public;
grant execute on function public.ai_calls_since(timestamptz) to authenticated;

commit;

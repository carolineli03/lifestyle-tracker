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

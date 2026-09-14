-- ---------------------------------------------------------------------------
-- Lifestyle Tracker: meal sections, fiber/sugar/sodium, barcodes, water,
-- exercise calories, body measurements and progress photos
--
-- Additive: every new column is nullable or has a default, so existing rows
-- and older app builds keep working. The exception is log_entry, whose
-- signature changes again. It is dropped and recreated so PostgREST never
-- sees two overloads.
-- ---------------------------------------------------------------------------

-- --- the food log ------------------------------------------------------------

-- Which meal an entry belongs to. Nullable: entries from before this existed
-- show under "Other" rather than being guessed into a meal.
alter table public.entries
  add column meal      public.meal_slot,
  add column fiber_g   numeric(7, 2) check (fiber_g is null or fiber_g >= 0),
  add column sugar_g   numeric(7, 2) check (sugar_g is null or sugar_g >= 0),
  add column sodium_mg numeric(8, 1) check (sodium_mg is null or sodium_mg >= 0);

alter table public.foods
  add column fiber_g       numeric(7, 2) check (fiber_g is null or fiber_g >= 0),
  add column sugar_g       numeric(7, 2) check (sugar_g is null or sugar_g >= 0),
  add column sodium_mg     numeric(8, 1) check (sodium_mg is null or sodium_mg >= 0),
  -- What one serving is, as printed ("2/3 cup (55g)").
  add column serving_label text check (serving_label is null or length(serving_label) <= 80),
  -- A scanned product is remembered, so the next scan never leaves the kitchen.
  add column barcode       text check (barcode is null or barcode ~ '^[0-9]{6,14}$');

create unique index foods_household_barcode_key
  on public.foods (household_id, barcode)
  where barcode is not null;

-- --- targets and settings ---------------------------------------------------

alter table public.profiles
  add column fiber_target      integer check (fiber_target is null or fiber_target between 0 and 200),
  add column sugar_limit       integer check (sugar_limit is null or sugar_limit between 0 and 500),
  add column sodium_limit      integer check (sodium_limit is null or sodium_limit between 0 and 20000),
  add column water_goal_oz     integer not null default 64 check (water_goal_oz between 0 and 400),
  -- MyFitnessPal-style "eat back" of exercise calories. Off by default:
  -- estimates of calories burned run high, and eating them all back is a
  -- common way a deficit quietly disappears.
  add column eat_back_exercise boolean not null default false;

-- Estimated when logged, from the activity and the latest weigh-in. Stored so
-- that a later weigh-in doesn't rewrite last month's numbers.
alter table public.movement
  add column kcal integer check (kcal is null or kcal between 0 and 10000);

-- --- private logs -------------------------------------------------------------

create table public.water_logs (
  user_id    uuid not null references auth.users (id) on delete cascade,
  id         uuid primary key default gen_random_uuid(),
  logged_on  date not null default current_date,
  amount_oz  numeric(6, 1) not null check (amount_oz > 0 and amount_oz <= 200),
  created_at timestamptz not null default now()
);
create index water_logs_user_day_idx on public.water_logs (user_id, logged_on desc);

create table public.body_measurements (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          uuid primary key default gen_random_uuid(),
  measured_on date not null default current_date,
  kind        text not null check (length(trim(kind)) between 1 and 40),
  value_in    numeric(5, 2) not null check (value_in > 0 and value_in < 200),
  created_at  timestamptz not null default now(),
  -- One reading per kind per day; saving again replaces it.
  unique (user_id, measured_on, kind)
);

create table public.progress_photos (
  user_id      uuid not null references auth.users (id) on delete cascade,
  id           uuid primary key default gen_random_uuid(),
  taken_on     date not null default current_date,
  -- "<user id>/<photo id>.jpg" inside the private progress-photos bucket.
  storage_path text not null unique,
  note         text check (note is null or length(note) <= 200),
  created_at   timestamptz not null default now(),
  check (split_part(storage_path, '/', 1) = user_id::text)
);
create index progress_photos_user_idx on public.progress_photos (user_id, taken_on desc);

alter table public.water_logs        enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos   enable row level security;

create policy "water is private"
  on public.water_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "measurements are private"
  on public.body_measurements for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress photos are private"
  on public.progress_photos for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- --- progress photo storage ---------------------------------------------------
-- A private bucket: nothing is public and every read goes through a signed URL.
-- The policies scope each object to the folder named after its owner, so
-- one person can never list, read, overwrite or delete the other's photos.

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "progress photos: owner reads"
  on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "progress photos: owner uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "progress photos: owner deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- --- log_entry ----------------------------------------------------------------
-- Adds meal, fiber/sugar/sodium, serving label and barcode. A new food is
-- still created from the per-serving values, and an existing library row is
-- still never overwritten, except that a food that didn't have a barcode or
-- serving label yet picks them up.

-- greatest(NULL, 0) is 0 in Postgres, which would record "0 g fiber" for a
-- food whose fiber is simply unknown. Unknown has to stay NULL.
create or replace function public.nonneg_or_null(p numeric)
returns numeric
language sql
immutable
as $$ select case when p is null then null else greatest(p, 0) end $$;

drop function if exists public.log_entry(text, integer, numeric, numeric, numeric, date, boolean);
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
  p_serving_fat_g     numeric default null,
  p_meal              public.meal_slot default null,
  p_fiber_g           numeric default null,
  p_sugar_g           numeric default null,
  p_sodium_mg         numeric default null,
  p_serving_fiber_g   numeric default null,
  p_serving_sugar_g   numeric default null,
  p_serving_sodium_mg numeric default null,
  p_serving_label     text default null,
  p_barcode           text default null
)
returns public.entries
language plpgsql
set search_path = public
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_household uuid := public.current_household_id();
  v_name      text := nullif(trim(p_name), '');
  v_barcode   text := nullif(trim(p_barcode), '');
  v_food_id   uuid;
  v_entry     public.entries;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_name is null then
    raise exception 'A food needs a name.' using errcode = '22023';
  end if;

  if p_remember and v_household is not null then
    insert into public.foods (
      household_id, name, kcal, protein_g, carb_g, fat_g,
      fiber_g, sugar_g, sodium_mg, serving_label, barcode,
      times_logged, last_logged_at
    )
    values (
      v_household, v_name,
      greatest(coalesce(p_serving_kcal, p_kcal, 0), 0),
      greatest(coalesce(p_serving_protein_g, p_protein_g, 0), 0),
      greatest(coalesce(p_serving_carb_g, p_carb_g, 0), 0),
      greatest(coalesce(p_serving_fat_g, p_fat_g, 0), 0),
      public.nonneg_or_null(coalesce(p_serving_fiber_g, p_fiber_g)),
      public.nonneg_or_null(coalesce(p_serving_sugar_g, p_sugar_g)),
      public.nonneg_or_null(coalesce(p_serving_sodium_mg, p_sodium_mg)),
      nullif(trim(p_serving_label), ''),
      v_barcode,
      1, now()
    )
    on conflict (household_id, lower(trim(name)))
    do update set
      times_logged   = public.foods.times_logged + 1,
      last_logged_at = now(),
      serving_label  = coalesce(public.foods.serving_label, excluded.serving_label),
      barcode        = coalesce(public.foods.barcode, excluded.barcode)
    returning id into v_food_id;
  end if;

  insert into public.entries (
    user_id, logged_on, meal, name, kcal, protein_g, carb_g, fat_g,
    fiber_g, sugar_g, sodium_mg, food_id
  )
  values (
    v_uid,
    coalesce(p_logged_on, current_date),
    p_meal,
    v_name,
    greatest(coalesce(p_kcal, 0), 0),
    greatest(coalesce(p_protein_g, 0), 0),
    greatest(coalesce(p_carb_g, 0), 0),
    greatest(coalesce(p_fat_g, 0), 0),
    public.nonneg_or_null(p_fiber_g),
    public.nonneg_or_null(p_sugar_g),
    public.nonneg_or_null(p_sodium_mg),
    v_food_id
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function public.log_entry(
  text, integer, numeric, numeric, numeric, date, boolean, integer, numeric, numeric, numeric,
  public.meal_slot, numeric, numeric, numeric, numeric, numeric, numeric, text, text
) from public;
grant execute on function public.log_entry(
  text, integer, numeric, numeric, numeric, date, boolean, integer, numeric, numeric, numeric,
  public.meal_slot, numeric, numeric, numeric, numeric, numeric, numeric, text, text
) to authenticated;

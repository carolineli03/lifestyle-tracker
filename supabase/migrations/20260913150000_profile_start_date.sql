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

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

-- ---------------------------------------------------------------------------
-- Minimal stand-in for the parts of a Supabase database that our migrations
-- depend on: the auth schema, the auth.uid() helper, and the three roles that
-- PostgREST switches into.
--
-- This exists so the RLS suite can run against any plain Postgres instance
-- instead of requiring Docker and the full Supabase stack. The policies under
-- test are the real ones from supabase/migrations — only the surrounding
-- scaffolding is faked, and auth.uid() below is the same expression Supabase
-- ships.
-- ---------------------------------------------------------------------------

create schema if not exists extensions;
create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- Verbatim behaviour of Supabase's auth.uid(): read the subject claim out of
-- the request-scoped JWT settings that PostgREST populates.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

grant usage on schema auth to authenticated, anon, service_role;
grant select on auth.users to authenticated, service_role;

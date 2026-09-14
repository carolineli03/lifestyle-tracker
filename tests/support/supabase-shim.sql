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

-- ---------------------------------------------------------------------------
-- Supabase Storage, reduced to what the progress-photo policies touch: the
-- buckets and objects tables, RLS on objects, and storage.foldername(), which
-- behaves the same way as Supabase's own version.
-- ---------------------------------------------------------------------------

create schema if not exists storage;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text not null,
  owner     uuid,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

grant usage on schema storage to authenticated, anon, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

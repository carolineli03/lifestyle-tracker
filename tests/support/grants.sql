-- Supabase grants table privileges to anon/authenticated by default; RLS is
-- what actually restricts the rows. Replicate that here so the policies (not a
-- missing GRANT) are what the suite is measuring.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

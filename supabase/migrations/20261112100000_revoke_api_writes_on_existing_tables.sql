-- 20261112060000_lock_down_public_schema_defaults only changed the defaults
-- for tables created after it. The tables that already existed kept
-- Supabase's default grants, so anon and authenticated still held INSERT,
-- UPDATE and DELETE on them. With the ownership policy on example_entities
-- (FOR ALL USING (auth.uid() = user_id), which doubles as WITH CHECK), any
-- signed-in user could insert or update their own rows straight through the
-- REST API, skipping the app's validation and policies.
--
-- The app writes with the service role, so the API roles need no write
-- privileges. SELECT stays: reads are governed by RLS (own rows only).

REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.example_entities FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.account_deletion_requests FROM anon, authenticated;

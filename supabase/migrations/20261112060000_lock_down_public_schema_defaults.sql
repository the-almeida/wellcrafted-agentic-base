-- Supabase's default privileges give anon and authenticated full access to
-- every new table and EXECUTE on every new function in the public schema.
-- That is how public.users ended up readable and writable through the REST
-- API with the public anon key (fixed in 20261112044058_enable_rls_users).
-- The app reaches the database with the service role, so the public API
-- needs nothing here by default; a table or function meant for it must be
-- granted explicitly, with RLS.

-- New objects created by postgres (Drizzle and Supabase migrations) start
-- with no privileges for the API roles.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- The account purge is SECURITY DEFINER and deletes auth users; only
-- pg_cron (running as postgres) calls it. Through the API it was an
-- unauthenticated, side-effecting endpoint.
REVOKE EXECUTE ON FUNCTION public.purge_expired_account_deletions() FROM PUBLIC, anon, authenticated;

-- Trigger function; PostgREST cannot call it, revoked for tidiness.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

-- RLS does not apply to TRUNCATE.
REVOKE TRUNCATE ON public.example_entities FROM anon, authenticated;
REVOKE TRUNCATE ON public.account_deletion_requests FROM anon, authenticated;

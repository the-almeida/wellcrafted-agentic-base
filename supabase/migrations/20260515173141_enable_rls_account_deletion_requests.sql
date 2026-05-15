-- RLS for account_deletion_requests.
--
-- The backend uses the service role key (which bypasses RLS), so these
-- policies fire only if a future caller ever connects under the
-- `authenticated` role. Business logic stays in the app layer
-- (auth module's Policy / Server Actions wrapped with withErrorBoundary).
--
-- Ownership-only model:
--   - SELECT: a signed-in user can read their own rows (the public
--     status page reads anonymously via the service role using the
--     confirmation_code, so anon users have no policy here).
--   - INSERT/UPDATE/DELETE: no policy. Direct writes from the
--     authenticated role are rejected. The auth module's Server
--     Actions perform validated writes through the service role.

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_account_deletion_requests_select" ON public.account_deletion_requests
  FOR SELECT USING (auth.uid() = user_id);

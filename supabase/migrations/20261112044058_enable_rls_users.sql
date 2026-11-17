-- public.users had no RLS, and Supabase grants anon and authenticated full
-- table privileges by default, so anyone with the public anon key could list
-- every account (email, name) through the REST API, and a signed-in user
-- could set their own role to admin or delete their row.
--
-- The app reads and writes this table with the service role, which bypasses
-- RLS. The auth sync trigger (handle_new_auth_user) is SECURITY DEFINER and
-- owned by postgres, so it keeps inserting rows. These policies apply only to
-- callers that come through the public API.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Read your own row only. No INSERT, UPDATE or DELETE policy on purpose:
-- an own-row UPDATE policy would let users change their own role.
CREATE POLICY "users_read_own_row" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- RLS does not apply to TRUNCATE; nothing outside the backend needs it.
REVOKE TRUNCATE ON public.users FROM anon, authenticated;

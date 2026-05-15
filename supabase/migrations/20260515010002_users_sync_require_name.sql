-- Hard DB invariant: every auth.users row must have a non-blank
-- display name in `raw_user_meta_data` (either `name` or `full_name`).
-- If it doesn't, the trigger raises and the INSERT is rolled back —
-- so no auth.users row, no public.users row, no session.
--
-- This makes "no users without names" a structural property of the
-- database, not just an app-layer convention. Every code path that
-- creates auth.users — password sign-up, OTP, OAuth, admin operations,
-- Supabase Studio — must supply a name or fail at the DB boundary.
--
-- For OAuth specifically, the rare Facebook-scope-denial case (#24)
-- now produces a clean error instead of a half-completed account.
-- The user can retry with the profile permission granted and the
-- second attempt creates the row correctly.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_name text;
BEGIN
  resolved_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', '')
  );

  IF resolved_name IS NULL OR btrim(resolved_name) = '' THEN
    RAISE EXCEPTION 'name is required: raw_user_meta_data must contain a non-blank "name" or "full_name"'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, resolved_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

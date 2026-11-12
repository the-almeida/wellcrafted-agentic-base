-- Converting an anonymous account (updateUser({ email, password })) makes
-- Supabase Auth clear auth.users.is_anonymous in one UPDATE and set the email
-- in a later one. Mirroring is_anonymous as is made public.users a
-- non-anonymous row without an email for a moment, which the check
-- users_email_unless_anonymous refuses: the whole conversion failed with a
-- 500. The mirror now stays anonymous until the email arrives.

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email,
      is_anonymous = NEW.is_anonymous OR NEW.email IS NULL,
      email_verified_at = CASE
        WHEN OLD.email IS DISTINCT FROM NEW.email THEN NULL
        ELSE email_verified_at
      END,
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_auth_user_email_change() FROM PUBLIC, anon, authenticated;

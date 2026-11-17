-- public.users mirrors auth.users, but only on INSERT
-- (20260515160417_users_auth_sync). An email change in Supabase Auth left
-- public.users.email stale. This trigger follows email changes.
--
-- It copies the email only. It never reads raw_user_meta_data: users can
-- edit their own metadata through the Supabase API (updateUser({ data })),
-- so copying it would let them rewrite app data past the app's validation.
--
-- A new email is not proven yet, so the app's verification record
-- (email_verified_at) is cleared; the next code or OAuth sign-in sets it.

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email,
      email_verified_at = NULL,
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_auth_user_email_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_auth_user_email_change();

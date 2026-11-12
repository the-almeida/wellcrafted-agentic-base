-- Anonymous accounts (Supabase's signInAnonymously): how they reach the
-- public.users mirror. The columns and checks come from the Drizzle
-- migration 20261112102000_add_anonymous_accounts; this file holds the
-- functions and triggers.
--
-- The checks on public.users are the real validation of a nickname: an
-- anonymous sign-in goes from the browser straight to Supabase Auth, so the
-- app never sees it, and anyone with the public anon key can send any
-- metadata. A row that breaks a check rolls back the auth.users insert, so
-- Supabase answers the sign-in with an error and no account exists.

-- A free discriminator (1..9999) for this nickname, drawn at random; NULL
-- when every number is taken (the profile check then refuses the row).
-- Nicknames compare case-insensitively, like the unique index. The unique
-- index also settles the rare race of two sign-ins drawing the same number:
-- one of them fails and the person retries.
CREATE OR REPLACE FUNCTION public.free_discriminator(p_nickname text)
RETURNS smallint
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT n::smallint
  FROM generate_series(1, 9999) AS n
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE lower(u.nickname) = lower(p_nickname) AND u.discriminator = n
  )
  ORDER BY random()
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.free_discriminator(text) FROM PUBLIC, anon, authenticated;

-- Insert: permanent accounts as before (email and name from metadata);
-- anonymous accounts get no email or name, and a public profile from the
-- nickname in their metadata.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nickname text;
BEGIN
  IF NEW.is_anonymous THEN
    v_nickname := NEW.raw_user_meta_data->>'nickname';
    INSERT INTO public.users (id, email, name, is_anonymous, nickname, discriminator)
    VALUES (NEW.id, NULL, NULL, true, v_nickname, public.free_discriminator(v_nickname))
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.users (id, email, name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(
        NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
        NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), '')
      )
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Update: also follow is_anonymous, which Supabase turns false when an
-- anonymous account becomes permanent (an email or identity is linked).
-- Keeps the id and the public profile. A changed email is not proven yet,
-- so the app's verification record is cleared only when the email changes.
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email,
      is_anonymous = NEW.is_anonymous,
      email_verified_at = CASE
        WHEN OLD.email IS DISTINCT FROM NEW.email THEN NULL
        ELSE email_verified_at
      END,
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email, is_anonymous ON auth.users
  FOR EACH ROW
  WHEN (
    OLD.email IS DISTINCT FROM NEW.email
    OR OLD.is_anonymous IS DISTINCT FROM NEW.is_anonymous
  )
  EXECUTE FUNCTION public.handle_auth_user_email_change();

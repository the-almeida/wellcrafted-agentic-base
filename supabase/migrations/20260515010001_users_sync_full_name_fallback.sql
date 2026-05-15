-- Extend the auth.users → public.users sync trigger so it falls back
-- to the `full_name` metadata field when `name` is missing. OAuth
-- providers (Google, Facebook) are inconsistent about which field they
-- populate; reading both keeps public.users.name correct without
-- requiring app-layer normalization on every sign-in.
--
-- CREATE OR REPLACE preserves the trigger definition; only the function
-- body changes.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', '')
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Link public.users to auth.users and keep them in sync on INSERT.
--
-- Drizzle owns the public.users column definitions (including the
-- name NOT NULL + CHECK btrim(name) <> '' constraints from the
-- preceding migration). This file owns:
--
-- 1. The foreign key from public.users.id to auth.users(id). Supabase
--    Auth is the source of truth for identity; public.users is a
--    mirror. ON DELETE CASCADE keeps the two tables in sync when an
--    auth user is removed.
--
-- 2. The on_auth_user_created trigger. Supabase Auth creates rows in
--    auth.users via multiple paths (password sign-up, OTP, OAuth,
--    admin operations, Supabase Studio). The trigger sits at that
--    chokepoint and creates the public.users mirror in the same
--    transaction.
--
-- The trigger is pure sync: COALESCE with NULLIF(btrim(...), '')
-- normalises whitespace-only metadata to null, and the column
-- constraints on public.users.name reject any row that fails the
-- name invariant — rolling back the entire auth.users insert.

ALTER TABLE public.users
  ADD CONSTRAINT users_id_auth_users_fkey
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

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
      NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), '')
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

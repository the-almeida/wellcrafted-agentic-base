-- Now that public.users.name is NOT NULL (preceding Drizzle migration),
-- the trigger no longer needs to RAISE when name metadata is missing —
-- the column constraint rolls back the same way. Two changes here:
--
-- 1. Add a CHECK constraint that name is non-blank. NOT NULL alone
--    accepts '   '; we want a hard "must contain at least one
--    non-whitespace character" guarantee. This is belt-and-suspenders:
--    if a future code path bypasses the trigger (admin updates,
--    Supabase Studio, manual SQL), the constraint still rejects.
--
-- 2. Shrink the trigger to pure sync. The COALESCE now normalises
--    whitespace via NULLIF(btrim(...), '') so any blank-after-trim
--    metadata coerces to null before the INSERT. Whatever survives
--    must satisfy both NOT NULL and the CHECK constraint — exactly
--    what we want, declared at the column level instead of inline
--    business logic in the trigger.

ALTER TABLE public.users
  ADD CONSTRAINT users_name_not_blank CHECK (btrim(name) <> '');

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

-- The first proof of an account's email (an emailed code, or an OAuth
-- sign-in) secures it in one transaction: with Confirm email off, any
-- password on the account may have been set by someone who never owned the
-- email. The column auth_locked_until comes from the Drizzle migration
-- 20261113144842_add_users_auth_locked_until; this file holds the function
-- and the trigger.
--
-- Doing it through Supabase Auth's API took three calls (new password, end
-- other sessions, record the proof), and a request from another session
-- could land between them. Even in one transaction, a request that passed
-- Supabase's session check just before it still writes just after it:
-- Supabase checks the session once, then writes. So the account is locked
-- for a few seconds after the proof, and the database refuses Supabase
-- Auth's writes to it meanwhile (signing in writes last_sign_in_at in the
-- same transaction that opens the session, so a late sign-in fails too).

-- Called by the app on the session that just proved `p_email`, which is
-- `p_keep_session` and stays signed in. On the first proof of the account's
-- current email: replaces the password with a random one (harmless when
-- nobody had set one), ends the other sessions, records the proof and locks
-- the account. Otherwise changes nothing. ask_for_password: the account
-- existed before this sign-in (a code or OAuth sign-up creates it in the same
-- flow that proves it), so asking for a new password makes sense.
CREATE OR REPLACE FUNCTION public.secure_first_email_proof(
  p_user_id uuid,
  p_email text,
  p_keep_session uuid
)
RETURNS TABLE (secured boolean, ask_for_password boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existed_before boolean;
BEGIN
  -- Supabase Auth's writes to the account queue behind this lock.
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;

  SELECT u.created_at < now() - interval '5 minutes'
  INTO v_existed_before
  FROM public.users u
  WHERE u.id = p_user_id
    AND u.email_verified_at IS NULL
    AND lower(u.email) = lower(p_email)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(
        encode(extensions.gen_random_bytes(32), 'base64'),
        extensions.gen_salt('bf')
      ),
      updated_at = now()
  WHERE id = p_user_id;

  -- Their refresh tokens go with them (ON DELETE CASCADE).
  DELETE FROM auth.sessions
  WHERE user_id = p_user_id AND id IS DISTINCT FROM p_keep_session;

  UPDATE public.users
  SET email_verified_at = now(),
      auth_locked_until = now() + interval '15 seconds',
      updated_at = now()
  WHERE id = p_user_id;

  RETURN QUERY SELECT true, v_existed_before;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.secure_first_email_proof(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- Refuses any change to a locked account. The row lock is taken before this
-- runs, so a write that queued behind the securing transaction sees its lock.
CREATE OR REPLACE FUNCTION public.refuse_auth_writes_while_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = NEW.id AND auth_locked_until > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'account % was just secured; try again in a few seconds', NEW.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refuse_auth_writes_while_locked() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_update_while_locked
  BEFORE UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.refuse_auth_writes_while_locked();

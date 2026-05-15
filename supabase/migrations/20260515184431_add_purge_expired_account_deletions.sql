-- Purge expired account deletion requests.
--
-- The function selects every active request whose grace period has
-- elapsed, deletes the matching auth.users row (cascading into
-- public.users and any user-owned tables that declare
-- ON DELETE CASCADE), and stamps `completed_at` on the request. The
-- account_deletion_requests row itself is retained as an audit trail —
-- the FK to public.users is ON DELETE SET NULL, so user_id becomes
-- null when the cascade fires.
--
-- Idempotency:
--   - The `cancelled_at IS NULL AND completed_at IS NULL` filter
--     guarantees a row is processed at most once, even if two purge
--     runs overlap.
--   - `auth.admin.deleteUser` semantics are preserved by using a direct
--     DELETE FROM auth.users; the existing trigger on auth.users
--     cascades into public.users, and FOREIGN KEY CASCADE drops owned
--     rows in user-defined tables.
--   - If auth.users for a given user_id is already gone (e.g. manual
--     cleanup, prior partial run), the DELETE returns zero rows and the
--     function still stamps `completed_at` so the request leaves the
--     active set.
--
-- SECURITY DEFINER lets pg_cron (which runs as `postgres`) invoke the
-- function without granting blanket DELETE on auth.users to the cron
-- role. `search_path` is pinned to defeat search-path injection.

-- pg_cron is shipped with Supabase Postgres; the extension lives in
-- the `extensions` schema in hosted Supabase and in the default
-- search_path locally. Creating it here is idempotent.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_expired_account_deletions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  expired record;
BEGIN
  FOR expired IN
    SELECT id, user_id
    FROM public.account_deletion_requests
    WHERE cancelled_at IS NULL
      AND completed_at IS NULL
      AND scheduled_for <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    IF expired.user_id IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = expired.user_id;
    END IF;

    UPDATE public.account_deletion_requests
    SET completed_at = now()
    WHERE id = expired.id;
  END LOOP;
END;
$$;

-- Schedule the purge to run hourly. The 30-day grace window means a
-- one-hour worst-case lag between scheduled_for and actual purge is
-- inconsequential. `cron.schedule` is idempotent by jobname only via
-- the unschedule/reschedule dance: drop any prior job with this name
-- before scheduling so the migration is re-runnable.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-account-deletions') THEN
    PERFORM cron.unschedule('purge-expired-account-deletions');
  END IF;
  PERFORM cron.schedule(
    'purge-expired-account-deletions',
    '0 * * * *',
    $cron$SELECT public.purge_expired_account_deletions()$cron$
  );
END;
$$;

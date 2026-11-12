import { ExternalServiceError } from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'

import { createSupabaseServerClient } from '../../adapters/supabase/server-client'

/**
 * Exchanges an OAuth authorization code for a Supabase session.
 *
 * Called from `src/app/auth/callback/route.ts` after a provider (Google,
 * Facebook) redirects the browser back to our app with `?code=<code>`.
 * The exchange uses the cookies set during `signInWithOAuth` (PKCE
 * verifier) and writes the resulting session cookies on the app origin,
 * so subsequent requests are authenticated.
 *
 * Route handlers are auto-captured by Sentry via `instrumentation.ts` —
 * no `withErrorBoundary` wrapper here (that's for server actions only).
 *
 * Name invariant: if the provider returned no `name` / `full_name`, the
 * `on_auth_user_created` trigger inserts a null name into `public.users`
 * and the column's `NOT NULL` constraint rolls back the whole sign-up. `exchangeCodeForSession` then returns a generic
 * "Database error" — we surface it as `oauth_failed` and the sign-in
 * page shows a hint suggesting the user grant the profile permission
 * and retry.
 */
export async function exchangeOauthCode(code: string): Promise<Result<void, ExternalServiceError>> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return err(new ExternalServiceError('supabase', error.message, { cause: error }))
  }
  return ok(undefined)
}

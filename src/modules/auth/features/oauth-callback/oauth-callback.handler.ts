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
 */
export async function exchangeOauthCode(code: string): Promise<Result<void, ExternalServiceError>> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return err(new ExternalServiceError('supabase', error.message, { cause: error }))
  }
  return ok(undefined)
}

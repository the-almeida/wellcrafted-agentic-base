import { authProvider } from '../../adapters/auth-provider.supabase'

import { completeOAuthSignInWith } from './oauth-callback.logic'

/**
 * Called from `src/app/auth/callback/route.ts`. Route handlers are
 * auto-captured by Sentry through `instrumentation.ts`, so no
 * `withErrorBoundary` here (that is for server actions).
 */
export function completeOAuthSignIn(code: string) {
  return completeOAuthSignInWith({ authProvider }, code)
}

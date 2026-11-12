import { ok } from '@/shared/lib/result'

import { userRepository } from '../../adapters/user-repository.drizzle'
import type { AuthProvider } from '../../ports/auth-provider'

/**
 * Finishes an OAuth sign-in (Google, Facebook) after the provider redirects
 * back to the app's callback with a code.
 *
 * Signing in through the provider proves the email, so it is recorded as
 * verified. This assumes the enabled providers only return verified emails
 * (Google and Facebook do); revisit it before enabling another provider.
 *
 * If the provider returned no name, the auth sync trigger's NOT NULL on
 * public.users.name rolls back the sign-up and Supabase answers with a
 * generic database error; it arrives here as EXTERNAL_SERVICE_ERROR.
 */
export async function completeOAuthSignInWith(
  { authProvider }: { authProvider: AuthProvider },
  code: string,
) {
  const result = await authProvider.exchangeOAuthCode(code)
  if (!result.ok) return result

  await userRepository.markEmailVerified(result.value.userId, result.value.email)
  return ok(result.value)
}

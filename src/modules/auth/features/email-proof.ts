import { UnauthenticatedError } from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'
import type { UserId } from '@/shared/lib/ids'

import { userRepository } from '../adapters/user-repository.drizzle'
import { AUTH_ERROR_MESSAGES, type AuthError, type AuthProvider } from '../ports/auth-provider'

/**
 * Runs after a sign-in proved control of `provenEmail` (an emailed code, or
 * an OAuth provider vouching for it), on the session that just signed in.
 *
 * With Confirm email off, an account can get a password from someone who
 * never owned the email (sign-up with password, keeping an anonymous
 * account, or calling Supabase directly). Supabase stores a random password
 * hash even for accounts created without one, so a password set by a person
 * cannot be told apart. So on the first proof of the email, whoever proved
 * it keeps the account: the password is replaced by a random one (harmless
 * when nobody had set one), the account's other sessions end, and for a few
 * seconds Supabase Auth cannot change the account, so a request another
 * session sent just before cannot undo it. All in one database transaction.
 * When the account existed before this sign-in, the answer asks for a new
 * password.
 */
export async function secureFirstEmailProof(
  authProvider: AuthProvider,
  userId: UserId,
  provenEmail: string,
): Promise<Result<{ mustSetPassword: boolean }, AuthError>> {
  const sessionId = await authProvider.currentSessionId()
  if (!sessionId) return err(new UnauthenticatedError(AUTH_ERROR_MESSAGES.unavailable))
  const proof = await userRepository.secureFirstEmailProof(userId, provenEmail, sessionId)
  return ok({ mustSetPassword: proof.askForPassword })
}

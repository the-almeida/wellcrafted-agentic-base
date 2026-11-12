import { randomBytes } from 'node:crypto'

import { ok, type Result } from '@/shared/lib/result'
import type { UserId } from '@/shared/lib/ids'

import { userRepository } from '../adapters/user-repository.drizzle'
import type { AuthError, AuthProvider } from '../ports/auth-provider'

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
 * when nobody had set one) and the account's other sessions end. When the
 * account existed before this sign-in, the answer asks for a new password.
 * Done before the email is marked verified, so a failure leaves it to
 * happen on the next proof.
 */
export async function secureFirstEmailProof(
  authProvider: AuthProvider,
  userId: UserId,
  provenEmail: string,
): Promise<Result<{ mustSetPassword: boolean }, AuthError>> {
  const proof = await userRepository.firstEmailProof(userId, provenEmail)
  if (proof.secure) {
    const replaced = await authProvider.replacePassword({
      password: randomBytes(32).toString('base64url'),
    })
    if (!replaced.ok) return replaced
    const ended = await authProvider.endOtherSessions()
    if (!ended.ok) return ended
  }
  await userRepository.markEmailVerified(userId, provenEmail)
  return ok({ mustSetPassword: proof.askForPassword })
}

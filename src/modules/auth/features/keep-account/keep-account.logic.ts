import { ConflictError } from '@/shared/lib/errors/base'
import { err, type Result } from '@/shared/lib/result'

import type { User } from '../../domain/user'
import type { AuthError, AuthIdentity, AuthProvider } from '../../ports/auth-provider'

import type { KeepAccountInput } from './keep-account.schema'

/**
 * Turns the caller's anonymous account into a permanent one: same id, same
 * public profile, now with an email and password to sign in with from
 * anywhere. Takes effect at once and the email stays unverified (Confirm
 * email is off): a made-up address works, but then the password cannot be
 * recovered. A later code or OAuth sign-in to that email verifies it.
 */
export async function keepAccountWith(
  { authProvider }: { authProvider: AuthProvider },
  user: User,
  input: KeepAccountInput,
): Promise<Result<AuthIdentity, AuthError>> {
  if (!user.isAnonymous) return err(new ConflictError('This account already has an email.'))
  return authProvider.addEmailAndPassword(input)
}

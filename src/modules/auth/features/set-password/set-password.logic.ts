import { RateLimitExceededError } from '@/shared/lib/rate-limit'
import { err } from '@/shared/lib/result'
import type { UserId } from '@/shared/lib/ids'

import { userRepository } from '../../adapters/user-repository.drizzle'
import type { AuthProvider } from '../../ports/auth-provider'

import type { SetPasswordInput } from './set-password.schema'

export const ACCOUNT_JUST_SECURED_MESSAGE =
  'Your account was just secured. Wait a few seconds and try again.'

/**
 * Sets a new password for the signed-in account (after its old one was
 * replaced). Supabase Auth refuses any change in the seconds after the
 * first proof of the email (see secureFirstEmailProof), so a person fast
 * enough to land there is asked to wait instead of seeing a failure.
 */
export async function setPasswordWith(
  { authProvider }: { authProvider: AuthProvider },
  userId: UserId,
  input: SetPasswordInput,
) {
  if (await userRepository.isAuthLocked(userId)) {
    return err(new RateLimitExceededError(`account:locked:${userId}`, ACCOUNT_JUST_SECURED_MESSAGE))
  }
  return authProvider.replacePassword({ password: input.password })
}

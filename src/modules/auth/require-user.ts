import { UnauthenticatedError } from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'

import { authProvider } from './adapters/auth-provider.supabase'
import { userRepository } from './adapters/user-repository.drizzle'
import type { User } from './domain/user'

/**
 * Fail-closed: returns `UnauthenticatedError` when no Supabase session
 * exists or the session-bearing user has no matching `public.users` row.
 *
 * Uses Supabase's `getUser()` (which round-trips to the auth API and verifies
 * the JWT). `getSession()` is unsafe for authorization (banned by lint).
 */
export async function requireUser(): Promise<Result<User, UnauthenticatedError>> {
  const identity = await authProvider.getCurrentIdentity()
  if (!identity) {
    return err(new UnauthenticatedError('not authenticated'))
  }
  const user = await userRepository.findById(identity.userId)
  if (!user) {
    return err(new UnauthenticatedError('user record not found'))
  }
  return ok(user)
}

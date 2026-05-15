import { AccountPendingDeletionError, UnauthenticatedError } from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'

import { authProvider } from './adapters/auth-provider.supabase'
import { userRepository } from './adapters/user-repository.drizzle'
import type { User } from './domain/user'
import { getActiveDeletionRequest } from './features/account-deletion/get-active-deletion-request'

/**
 * Fail-closed: returns `UnauthenticatedError` when no Supabase session
 * exists or the session-bearing user has no matching `public.users` row.
 *
 * Also fails with `AccountPendingDeletionError` for users with an active
 * account deletion request. This is the boilerplate default: business
 * actions refuse pending users automatically, no per-handler check
 * required. The two flows that legitimately operate during the grace
 * window (cancel deletion, sign out) use
 * `requireUserAllowPendingDeletion` instead.
 *
 * Uses Supabase's `getUser()` (which round-trips to the auth API and verifies
 * the JWT). `getSession()` is unsafe for authorization (banned by lint).
 */
export async function requireUser(): Promise<
  Result<User, UnauthenticatedError | AccountPendingDeletionError>
> {
  const identityResult = await requireUserAllowPendingDeletion()
  if (!identityResult.ok) return identityResult

  const active = await getActiveDeletionRequest(identityResult.value.id)
  if (active) {
    return err(new AccountPendingDeletionError(active.scheduledFor))
  }
  return identityResult
}

/**
 * Identity-only variant: confirms there is an authenticated user and a
 * matching `public.users` row, but does NOT reject users with a pending
 * account deletion. Use only for flows that must remain available during
 * the grace window (cancel deletion, request deletion idempotency, sign out).
 */
export async function requireUserAllowPendingDeletion(): Promise<
  Result<User, UnauthenticatedError>
> {
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

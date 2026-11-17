import {
  AccountPendingDeletionError,
  PermanentAccountRequiredError,
  UnauthenticatedError,
} from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'

import type { User } from './domain/user'
import { resolveCurrentUser } from './resolve-current-user'

/**
 * Account states a caller may let through besides the default (a permanent,
 * active account):
 *
 *   - `anonymous`: accounts from an anonymous sign-in, for pages and flows
 *     they may use (seeing the app, their profile, deleting the account).
 *     Writes that need a real account keep the default.
 *   - `pending-deletion`: accounts with an active deletion request, for the
 *     flows that must keep working during the grace period (the
 *     pending-deletion page, cancelling or re-requesting the deletion, and
 *     the protected layout that routes those users to that page).
 */
export type Allowance = 'anonymous' | 'pending-deletion'

/**
 * Fail-closed: `UnauthenticatedError` when there is no Supabase session or
 * the session's user has no `public.users` row; `PermanentAccountRequiredError`
 * for an anonymous account and `AccountPendingDeletionError` for one pending
 * deletion, unless `allow` lists them (when both apply, the anonymous one is
 * reported). Uses Supabase's `getUser()` (verifies the JWT); `getSession()`
 * is unsafe for authorization and banned by lint.
 */
export async function requireUser({ allow = [] }: { allow?: readonly Allowance[] } = {}): Promise<
  Result<User, UnauthenticatedError | PermanentAccountRequiredError | AccountPendingDeletionError>
> {
  const current = await resolveCurrentUser()
  if (current.status === 'signed-out') return err(new UnauthenticatedError('not authenticated'))
  if (current.status === 'no-record') return err(new UnauthenticatedError('user record not found'))

  const { user } = current
  if (user.isAnonymous && !allow.includes('anonymous')) {
    return err(new PermanentAccountRequiredError())
  }
  if (user.pendingDeletion && !allow.includes('pending-deletion')) {
    return err(new AccountPendingDeletionError(user.pendingDeletion.scheduledFor))
  }
  return ok(user)
}

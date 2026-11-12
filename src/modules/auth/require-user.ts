import { AccountPendingDeletionError, UnauthenticatedError } from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'

import type { User } from './domain/user'
import { resolveCurrentUser } from './resolve-current-user'

/**
 * What a caller may do with an account in each state:
 *
 *   - `full` (default): an active account only. Accounts pending deletion
 *     fail with `AccountPendingDeletionError`, so business actions refuse
 *     them without per-handler checks.
 *   - `grace-period`: also lets accounts pending deletion through, for the
 *     flows that must keep working during the grace period (the
 *     pending-deletion page, cancelling or re-requesting the deletion, and
 *     the protected layout that routes those users to that page).
 *
 * Open for more levels (anonymous mode adds one).
 */
export type Access = 'full' | 'grace-period'

/**
 * Fail-closed: `UnauthenticatedError` when there is no Supabase session or
 * the session's user has no `public.users` row. Uses Supabase's `getUser()`
 * (verifies the JWT); `getSession()` is unsafe for authorization and banned
 * by lint.
 */
export async function requireUser({ access = 'full' }: { access?: Access } = {}): Promise<
  Result<User, UnauthenticatedError | AccountPendingDeletionError>
> {
  const current = await resolveCurrentUser()
  if (current.status === 'signed-out') return err(new UnauthenticatedError('not authenticated'))
  if (current.status === 'no-record') return err(new UnauthenticatedError('user record not found'))

  const { user } = current
  switch (access) {
    case 'full':
      if (user.pendingDeletion) {
        return err(new AccountPendingDeletionError(user.pendingDeletion.scheduledFor))
      }
      return ok(user)
    case 'grace-period':
      return ok(user)
    default: {
      const unknown: never = access
      throw new Error(`unknown access level: ${String(unknown)}`)
    }
  }
}

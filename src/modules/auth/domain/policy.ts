import type { ForbiddenError } from '@/shared/lib/errors/base'
import { ok, type Result } from '@/shared/lib/result'

import type { User } from './user'

export type Policy<TAction> = (user: User, action: TAction) => Result<void, ForbiddenError>

export function isAdmin(user: User): boolean {
  return user.role === 'admin'
}

/**
 * The auth module's own actions. Today only account-deletion lifecycle.
 *
 * Any authenticated user can request or cancel deletion of their own
 * account; the action is implicitly scoped to self because the handlers
 * pass the caller's User (from `requireUserAllowPendingDeletion`) into
 * the policy and downstream logic. The policy still exists so that
 * future restrictions (e.g. "admin accounts cannot self-delete") have a
 * single place to live, and so that the boilerplate's "every handler
 * calls a policy" convention is consistent across modules.
 */
export type AccountDeletionAction = { type: 'request' } | { type: 'cancel' }

export const accountDeletionPolicy: Policy<AccountDeletionAction> = () => ok(undefined)

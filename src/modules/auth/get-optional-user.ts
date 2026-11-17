import type { User } from './domain/user'
import { resolveCurrentUser } from './resolve-current-user'

/**
 * Returns the current user when authenticated, or `null` when not. Use this
 * for pages that render differently for guests vs signed-in users (sign-in
 * page redirect-when-already-authed, headers with avatar menu, landing
 * personalization). It does not gate on account state: a user pending
 * deletion is returned with `pendingDeletion` set.
 *
 * For protected routes that should reject anonymous callers, use
 * `requireUser` instead.
 */
export async function getOptionalUser(): Promise<User | null> {
  const current = await resolveCurrentUser()
  return current.status === 'signed-in' ? current.user : null
}

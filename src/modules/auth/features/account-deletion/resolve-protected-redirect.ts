import type { User } from '../../domain/user'

export const PENDING_DELETION_PATH = '/account/pending-deletion'
export const ACCOUNT_HOME_PATH = '/account'

/**
 * Decides whether a signed-in user hitting a protected route should be
 * redirected elsewhere before the page renders. Returns the redirect target
 * (an absolute pathname) or `null` if the request should proceed as-is.
 *
 * Pure: reads the account state that came with the user (no query).
 *
 *   - Users with an active deletion request are funneled to the
 *     interstitial at PENDING_DELETION_PATH unless they are already there.
 *   - Users without an active request who land on the interstitial are
 *     sent back to ACCOUNT_HOME_PATH (the interstitial is meaningless for
 *     them and exposing it would invite confusion).
 */
export function resolveProtectedRouteRedirect(user: User, pathname: string): string | null {
  const pending = user.pendingDeletion !== null
  if (pending && pathname !== PENDING_DELETION_PATH) {
    return PENDING_DELETION_PATH
  }
  if (!pending && pathname === PENDING_DELETION_PATH) {
    return ACCOUNT_HOME_PATH
  }
  return null
}

import type { UserId } from '@/shared/lib/ids'

import { getActiveDeletionRequest } from './get-active-deletion-request'

export const PENDING_DELETION_PATH = '/account/pending-deletion'
export const ACCOUNT_HOME_PATH = '/account'

/**
 * Decides whether a signed-in user hitting a protected route should be
 * redirected elsewhere before the page renders. Returns the redirect target
 * (an absolute pathname) or `null` if the request should proceed as-is.
 *
 *   - Users with an active deletion request are funneled to the
 *     interstitial at PENDING_DELETION_PATH unless they are already there.
 *   - Users without an active request who land on the interstitial are
 *     sent back to ACCOUNT_HOME_PATH (the interstitial is meaningless for
 *     them and exposing it would invite confusion).
 */
export async function resolveProtectedRouteRedirect(
  userId: UserId,
  pathname: string,
): Promise<string | null> {
  const active = await getActiveDeletionRequest(userId)
  if (active && pathname !== PENDING_DELETION_PATH) {
    return PENDING_DELETION_PATH
  }
  if (!active && pathname === PENDING_DELETION_PATH) {
    return ACCOUNT_HOME_PATH
  }
  return null
}

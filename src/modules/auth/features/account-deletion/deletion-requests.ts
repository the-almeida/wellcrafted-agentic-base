import { randomBytes } from 'node:crypto'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import {
  accountDeletionRequests,
  type AccountDeletionRequestRow,
} from '@/shared/db/schema/account-deletion'
import { env } from '@/shared/lib/env'
import type { UserId } from '@/shared/lib/ids'

/**
 * Single owner of the "account deletion request" lifecycle rules shared by
 * every entry point (self-serve request, Facebook data-deletion callback,
 * the `requireUser` gate and the protected-route redirect):
 *
 *   - what "active" means (not cancelled, not completed);
 *   - how the grace period turns into `scheduledFor`;
 *   - how confirmation codes are generated;
 *   - idempotency: at most one active request per user, and opening a
 *     request when one is active returns the existing row;
 *   - concurrency: two openers racing past the precheck both observe the
 *     same row instead of one of them failing.
 *
 * Callers decide authentication/authorization and response shape; they do
 * not touch `account_deletion_requests` directly.
 */

export type DeletionRequestSource = AccountDeletionRequestRow['source']

const DAY_MS = 24 * 60 * 60 * 1000

// Postgres SQLSTATE 23505 = unique_violation. Two concurrent openers for the
// same user both pass the precheck; only the second hits the partial unique
// index `account_deletion_requests_active_user_idx`. We catch that case and
// re-read so the loser still observes the idempotent "active request
// exists" result.
const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ((error as { code?: unknown }).code === UNIQUE_VIOLATION) return true
  // Drizzle may wrap the driver error; the SQLSTATE then lives on `cause`.
  return isUniqueViolation((error as { cause?: unknown }).cause)
}

/**
 * Random 16-byte URL-safe token (22 chars). Also used by the Facebook
 * callback for unknown users, so the response shape never reveals whether
 * an identity exists.
 */
export function generateConfirmationCode(): string {
  return randomBytes(16).toString('base64url')
}

export async function getActiveDeletionRequest(
  userId: UserId,
): Promise<AccountDeletionRequestRow | null> {
  const [row] = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.userId, userId),
        isNull(accountDeletionRequests.cancelledAt),
        isNull(accountDeletionRequests.completedAt),
      ),
    )
    .limit(1)
  return row ?? null
}

/**
 * Opens a deletion request for `userId`, or returns the active one if it
 * already exists (regardless of which source opened it). Safe under
 * concurrent calls from any mix of sources.
 */
export async function openDeletionRequest(
  userId: UserId,
  source: DeletionRequestSource,
): Promise<AccountDeletionRequestRow> {
  const existing = await getActiveDeletionRequest(userId)
  if (existing) return existing

  const scheduledFor = new Date(Date.now() + env.ACCOUNT_DELETION_GRACE_DAYS * DAY_MS)
  try {
    const [row] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor,
        source,
        confirmationCode: generateConfirmationCode(),
      })
      .returning()
    if (!row) throw new Error('deletion request insert returned no rows')
    return row
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await getActiveDeletionRequest(userId)
      if (raced) return raced
    }
    throw error
  }
}

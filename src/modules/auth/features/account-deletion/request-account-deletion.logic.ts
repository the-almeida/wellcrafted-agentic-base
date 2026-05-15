import { randomBytes } from 'node:crypto'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import {
  accountDeletionRequests,
  type AccountDeletionRequestRow,
} from '@/shared/db/schema/account-deletion'
import { env } from '@/shared/lib/env'
import { ok, type Result } from '@/shared/lib/result'

import type { User } from '../../domain/user'

function generateConfirmationCode(): string {
  return randomBytes(16).toString('base64url')
}

async function findActiveRequest(userId: User['id']) {
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
  return row
}

// Postgres SQLSTATE 23505 = unique_violation. Two concurrent inserts
// from the same user both pass the precheck and only the second hits
// the partial unique index `account_deletion_requests_active_user_idx`.
// We catch that case and re-read so the second caller still observes
// the idempotent "active request exists" semantics.
const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const code = (error as { code?: unknown }).code
  return code === UNIQUE_VIOLATION
}

export async function requestAccountDeletionForUser(
  user: User,
): Promise<Result<AccountDeletionRequestRow, never>> {
  const existing = await findActiveRequest(user.id)
  if (existing) return ok(existing)

  const scheduledFor = new Date(Date.now() + env.ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)
  try {
    const [row] = await db
      .insert(accountDeletionRequests)
      .values({
        userId: user.id,
        scheduledFor,
        source: 'user',
        confirmationCode: generateConfirmationCode(),
      })
      .returning()
    if (!row) throw new Error('deletion request insert returned no rows')
    return ok(row)
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await findActiveRequest(user.id)
      if (raced) return ok(raced)
    }
    throw error
  }
}

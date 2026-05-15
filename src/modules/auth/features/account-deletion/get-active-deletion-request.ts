import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import {
  accountDeletionRequests,
  type AccountDeletionRequestRow,
} from '@/shared/db/schema/account-deletion'
import type { UserId } from '@/shared/lib/ids'

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

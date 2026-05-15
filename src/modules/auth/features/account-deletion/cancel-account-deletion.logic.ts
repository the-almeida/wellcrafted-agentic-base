import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import {
  accountDeletionRequests,
  type AccountDeletionRequestRow,
} from '@/shared/db/schema/account-deletion'
import { NotFoundError } from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'

import type { User } from '../../domain/user'

export async function cancelAccountDeletionForUser(
  user: User,
): Promise<Result<AccountDeletionRequestRow, NotFoundError>> {
  const [row] = await db
    .update(accountDeletionRequests)
    .set({ cancelledAt: new Date() })
    .where(
      and(
        eq(accountDeletionRequests.userId, user.id),
        isNull(accountDeletionRequests.cancelledAt),
        isNull(accountDeletionRequests.completedAt),
      ),
    )
    .returning()

  if (!row) {
    return err(new NotFoundError('no active deletion request to cancel'))
  }
  return ok(row)
}

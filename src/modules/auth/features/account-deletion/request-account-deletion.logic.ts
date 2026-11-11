import type { AccountDeletionRequestRow } from '@/shared/db/schema/account-deletion'
import { ok, type Result } from '@/shared/lib/result'

import type { User } from '../../domain/user'

import { openDeletionRequest } from './deletion-requests'

export async function requestAccountDeletionForUser(
  user: User,
): Promise<Result<AccountDeletionRequestRow, never>> {
  return ok(await openDeletionRequest(user.id, 'user'))
}

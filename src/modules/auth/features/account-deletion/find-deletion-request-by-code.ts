import { eq } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import {
  accountDeletionRequests,
  type AccountDeletionRequestRow,
} from '@/shared/db/schema/account-deletion'

/**
 * Public-facing lookup by `confirmation_code`. The status page at
 * `/data-deletion/status` reads this — Facebook surfaces that URL to
 * users who may not have a session — so the function runs through the
 * service-role DB connection (bypassing RLS) and returns `null` for
 * anything that doesn't match a row.
 *
 * Returning `null` for empty/whitespace input keeps the caller's
 * "unknown code" branch trivial; the page renders the same generic
 * "processed or could not be found" message for all null returns so
 * the response never reveals which codes exist.
 */
// Confirmation codes are `randomBytes(16).toString('base64url')` → 22
// chars. Cap well above that to reject obviously-malformed input
// without paying for an indexed DB lookup. The cap also makes the
// query plan stable in the face of a caller passing a megabyte string.
const MAX_CODE_LENGTH = 64

export async function findDeletionRequestByCode(
  code: string,
): Promise<AccountDeletionRequestRow | null> {
  const trimmed = code.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_CODE_LENGTH) return null
  const [row] = await db
    .select()
    .from(accountDeletionRequests)
    .where(eq(accountDeletionRequests.confirmationCode, trimmed))
    .limit(1)
  return row ?? null
}

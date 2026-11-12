import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import { accountDeletionRequests, activeDeletionRequest } from '@/shared/db/schema/account-deletion'
import { users } from '@/shared/db/schema/auth'
import type { UserId } from '@/shared/lib/ids'

import type { User } from '../domain/user'

// Anonymous accounts (and accounts converted from one, which have no name)
// have no User shape in the app yet: they read as "no record", so
// requireUser fails closed for them.
function rowToUser(
  row: typeof users.$inferSelect,
  pendingDeletion: User['pendingDeletion'],
): User | null {
  if (row.isAnonymous || row.email === null || row.name === null) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    pendingDeletion,
    emailVerifiedAt: row.emailVerifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// No port in front: one implementation, tested against the local database
// (ADR-0007). Rows are created by the auth trigger, not by the app.
export const userRepository = {
  // One query for the user and their account state. The active-request
  // condition must stay in the join (ON), not in WHERE: in WHERE, a user
  // whose requests were all cancelled would not be found at all.
  async findById(id: UserId) {
    const [row] = await db
      .select({ user: users, scheduledFor: accountDeletionRequests.scheduledFor })
      .from(users)
      .leftJoin(
        accountDeletionRequests,
        and(eq(accountDeletionRequests.userId, users.id), activeDeletionRequest()),
      )
      .where(eq(users.id, id))
      .limit(1)
    if (!row) return null
    return rowToUser(row.user, row.scheduledFor ? { scheduledFor: row.scheduledFor } : null)
  },
  /**
   * Records that the person proved control of `provenEmail` (a code sent
   * to it, or an OAuth provider vouching for it), only while it is still
   * the account's email: proving an old address must not verify a new one.
   * The first time wins: later calls keep it.
   */
  async markEmailVerified(id: UserId, provenEmail: string) {
    await db
      .update(users)
      .set({ emailVerifiedAt: sql`COALESCE(${users.emailVerifiedAt}, now())` })
      .where(and(eq(users.id, id), sql`lower(${users.email}) = lower(${provenEmail})`))
  },
}

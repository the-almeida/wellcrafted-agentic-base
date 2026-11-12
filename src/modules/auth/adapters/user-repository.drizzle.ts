import { and, eq } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import { accountDeletionRequests, activeDeletionRequest } from '@/shared/db/schema/account-deletion'
import { users } from '@/shared/db/schema/auth'
import type { UserId } from '@/shared/lib/ids'

import type { User } from '../domain/user'
import type { CreateUserInput, UserRepository } from '../ports/user-repository'

function rowToUser(row: typeof users.$inferSelect, pendingDeletion: User['pendingDeletion']): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    pendingDeletion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const userRepository: UserRepository = {
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
  async create(input: CreateUserInput) {
    const [row] = await db
      .insert(users)
      .values({
        id: input.id,
        email: input.email,
        name: input.name,
      })
      .returning()
    if (!row) throw new Error('user creation returned no rows')
    return rowToUser(row, null)
  },
}

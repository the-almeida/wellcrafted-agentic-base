import { eq } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import { users } from '@/shared/db/schema/auth'
import type { UserId } from '@/shared/lib/ids'

import type { User } from '../domain/user'
import type { CreateUserInput, UserRepository } from '../ports/user-repository'

function rowToUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const userRepository: UserRepository = {
  async findById(id: UserId) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return row ? rowToUser(row) : null
  },
  async findByEmail(email: string) {
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    return row ? rowToUser(row) : null
  },
  async create(input: CreateUserInput) {
    const [row] = await db
      .insert(users)
      .values({
        id: input.id,
        email: input.email,
        name: input.name ?? null,
      })
      .returning()
    if (!row) throw new Error('user creation returned no rows')
    return rowToUser(row)
  },
}

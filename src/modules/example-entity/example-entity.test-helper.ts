import { randomUUID } from 'node:crypto'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import { users, type UserRow } from '@/shared/db/schema/auth'
import { exampleEntities } from '@/shared/db/schema/example-entity'
import { cleanupAuthUser, createTestUser } from '@/shared/db/test-helpers'
import { UserIdSchema, type ExampleEntityId } from '@/shared/lib/ids'

import type { User } from '@/modules/auth'

// Built from the stored row, so what the policy sees is what is in the DB.
function userFromRow(row: UserRow): User {
  return {
    id: row.id,
    isAnonymous: row.isAnonymous,
    email: row.email,
    name: row.name,
    profile:
      row.nickname !== null && row.discriminator !== null
        ? { nickname: row.nickname, discriminator: row.discriminator }
        : null,
    role: row.role,
    pendingDeletion: null,
    emailVerifiedAt: row.emailVerifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function storedUser(id: string): Promise<User> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, UserIdSchema.parse(id)))
  if (!row) throw new Error('auth trigger did not create the public.users row')
  return userFromRow(row)
}

/**
 * Integration-test fixtures for the example module: real users (through
 * the auth trigger) and real rows. Call `cleanup()` in afterEach; deleting
 * the users cascades to their entities.
 */
export function exampleFixtures() {
  const userIds: string[] = []
  const anonymousIds: string[] = []

  return {
    async user(role: 'user' | 'admin' = 'user'): Promise<User> {
      const seeded = await createTestUser({ prefix: 'example', role })
      userIds.push(seeded.id)
      return storedUser(seeded.id)
    },
    // Inserted into auth.users with SQL, as an anonymous sign-in would
    // (real ones are limited per IP).
    async anonymousUser(): Promise<User> {
      const id = randomUUID()
      await db.execute(sql`
        INSERT INTO auth.users (id, aud, role, is_anonymous, raw_user_meta_data, created_at, updated_at)
        VALUES (${id}, 'authenticated', 'authenticated', true, '{"nickname":"Guest"}'::jsonb, now(), now())
      `)
      anonymousIds.push(id)
      return storedUser(id)
    },
    // A row written straight to the table, for owners the app would not let
    // create one (anonymous accounts).
    async insertEntityFor(owner: User, title = 'Original') {
      const [row] = await db
        .insert(exampleEntities)
        .values({ userId: owner.id, title, description: 'Kept' })
        .returning()
      if (!row) throw new Error('insert returned no row')
      return row
    },
    async row(id: ExampleEntityId) {
      const [row] = await db.select().from(exampleEntities).where(eq(exampleEntities.id, id))
      return row ?? null
    },
    async count(owner: User) {
      return (await db.select().from(exampleEntities).where(eq(exampleEntities.userId, owner.id)))
        .length
    },
    async cleanup() {
      for (const id of userIds.splice(0)) await cleanupAuthUser(id)
      // The Admin API does not find users inserted with SQL.
      for (const id of anonymousIds.splice(0)) {
        await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}`)
      }
    },
  }
}

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import { users } from '@/shared/db/schema/auth'
import { exampleEntities } from '@/shared/db/schema/example-entity'
import { cleanupAuthUser, createTestUser } from '@/shared/db/test-helpers'
import type { ExampleEntityId } from '@/shared/lib/ids'

import type { User } from '@/modules/auth'

/**
 * Integration-test fixtures for the example module: real users (through
 * the auth trigger) and real rows. Call `cleanup()` in afterEach; deleting
 * the users cascades to their entities.
 */
export function exampleFixtures() {
  const userIds: string[] = []

  return {
    async user(role: 'user' | 'admin' = 'user'): Promise<User> {
      const seeded = await createTestUser({ prefix: 'example', role })
      userIds.push(seeded.id)
      // Built from the stored row, so the role the policy sees is the one in the DB.
      const [row] = await db.select().from(users).where(eq(users.id, seeded.id))
      if (!row) throw new Error('auth trigger did not create the public.users row')
      return { ...row, pendingDeletion: null }
    },
    async row(id: ExampleEntityId) {
      const [row] = await db.select().from(exampleEntities).where(eq(exampleEntities.id, id))
      return row ?? null
    },
    async cleanup() {
      for (const id of userIds.splice(0)) await cleanupAuthUser(id)
    },
  }
}

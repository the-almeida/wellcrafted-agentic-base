import { eq } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import { exampleEntities } from '@/shared/db/schema/example-entity'
import type { ExampleEntityId, UserId } from '@/shared/lib/ids'

import type { ExampleEntity } from '../domain/example-entity'

// Database access with no port in front: one implementation, tested
// against the local database (ADR-0007).

export type NewExampleEntity = {
  userId: UserId
  title: string
  description?: string | null
}

export type UpdateExampleEntity = {
  title?: string
  description?: string | null
}

function rowToEntity(row: typeof exampleEntities.$inferSelect): ExampleEntity {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const exampleEntityRepository = {
  async findById(id: ExampleEntityId) {
    const [row] = await db.select().from(exampleEntities).where(eq(exampleEntities.id, id)).limit(1)
    return row ? rowToEntity(row) : null
  },
  async create(input: NewExampleEntity) {
    const [row] = await db
      .insert(exampleEntities)
      .values({
        userId: input.userId,
        title: input.title,
        description: input.description ?? null,
      })
      .returning()
    if (!row) throw new Error('example-entity insert returned no rows')
    return rowToEntity(row)
  },
  async update(id: ExampleEntityId, input: UpdateExampleEntity) {
    const [row] = await db
      .update(exampleEntities)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(exampleEntities.id, id))
      .returning()
    if (!row) throw new Error('example-entity update returned no rows')
    return rowToEntity(row)
  },
  async delete(id: ExampleEntityId) {
    await db.delete(exampleEntities).where(eq(exampleEntities.id, id))
  },
}

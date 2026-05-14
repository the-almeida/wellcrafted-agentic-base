import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import type { ExampleEntityId, UserId } from '@/shared/lib/ids'

import { users } from './auth'

export const exampleEntities = pgTable('example_entities', {
  id: uuid('id').primaryKey().defaultRandom().$type<ExampleEntityId>(),
  userId: uuid('user_id')
    .notNull()
    .$type<UserId>()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ExampleEntityRow = typeof exampleEntities.$inferSelect
export type NewExampleEntityRow = typeof exampleEntities.$inferInsert

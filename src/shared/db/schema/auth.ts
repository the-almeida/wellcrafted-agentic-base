import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import type { UserId } from '@/shared/lib/ids'

export const userRole = pgEnum('user_role', ['user', 'admin'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().$type<UserId>(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: userRole('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert

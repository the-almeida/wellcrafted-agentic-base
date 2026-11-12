import { sql } from 'drizzle-orm'
import { check, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import type { UserId } from '@/shared/lib/ids'

export const userRole = pgEnum('user_role', ['user', 'admin'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().$type<UserId>(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: userRole('role').notNull().default('user'),
    // When the person proved control of the email (an emailed code or an
    // OAuth sign-in). Null: not known to be verified, for example an account
    // created with a password while Confirm email is off. Set by the app,
    // not copied from auth.users.email_confirmed_at (autoconfirm sets that).
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('users_name_not_blank', sql`btrim(${table.name}) <> ''`)],
)

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert

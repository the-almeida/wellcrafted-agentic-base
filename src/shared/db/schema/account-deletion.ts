import { sql } from 'drizzle-orm'
import { pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import type { AccountDeletionRequestId, UserId } from '@/shared/lib/ids'

import { users } from './auth'

export const accountDeletionSource = pgEnum('account_deletion_source', ['user', 'facebook'])

export const accountDeletionRequests = pgTable(
  'account_deletion_requests',
  {
    id: uuid('id').primaryKey().defaultRandom().$type<AccountDeletionRequestId>(),
    userId: uuid('user_id')
      .$type<UserId>()
      .references(() => users.id, { onDelete: 'set null' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    source: accountDeletionSource('source').notNull(),
    confirmationCode: text('confirmation_code').notNull().unique(),
  },
  (table) => [
    uniqueIndex('account_deletion_requests_active_user_idx')
      .on(table.userId)
      .where(sql`${table.cancelledAt} IS NULL AND ${table.completedAt} IS NULL`),
  ],
)

export type AccountDeletionRequestRow = typeof accountDeletionRequests.$inferSelect
export type NewAccountDeletionRequestRow = typeof accountDeletionRequests.$inferInsert

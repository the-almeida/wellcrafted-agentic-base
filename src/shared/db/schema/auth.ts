import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import type { UserId } from '@/shared/lib/ids'

export const userRole = pgEnum('user_role', ['user', 'admin'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().$type<UserId>(),
    // Null only for anonymous accounts (see the checks below).
    email: text('email'),
    // Null for anonymous accounts, and for ones converted from anonymous.
    name: text('name'),
    role: userRole('role').notNull().default('user'),
    // Mirrors auth.users.is_anonymous (Supabase's anonymous sign-in).
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    // Public profile: how the account is shown to others ("Wolf #0042").
    // Required for anonymous accounts, optional for permanent ones.
    nickname: text('nickname'),
    discriminator: smallint('discriminator'),
    // When the person proved control of the email (an emailed code or an
    // OAuth sign-in). Null: not known to be verified, for example an account
    // created with a password while Confirm email is off. Set by the app,
    // not copied from auth.users.email_confirmed_at (autoconfirm sets that).
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('users_name_not_blank', sql`${table.name} IS NULL OR btrim(${table.name}) <> ''`),
    check('users_email_unless_anonymous', sql`${table.email} IS NOT NULL OR ${table.isAnonymous}`),
    check('users_named_somehow', sql`${table.name} IS NOT NULL OR ${table.nickname} IS NOT NULL`),
    check(
      'users_anonymous_has_profile',
      sql`NOT ${table.isAnonymous} OR ${table.nickname} IS NOT NULL`,
    ),
    check('users_anonymous_not_admin', sql`NOT ${table.isAnonymous} OR ${table.role} = 'user'`),
    check(
      'users_profile_complete',
      sql`(${table.nickname} IS NULL) = (${table.discriminator} IS NULL)`,
    ),
    check('users_discriminator_range', sql`${table.discriminator} BETWEEN 1 AND 9999`),
    // 2 to 24 characters; letters (with Latin accents), digits, space, _ . -;
    // a letter or digit at both ends. Excludes emoji, symbols and bidi
    // controls. Mirrored by the nickname schema the form uses.
    check(
      'users_nickname_format',
      sql`${table.nickname} ~ '^[A-Za-z0-9À-ÖØ-öø-ÿ][A-Za-z0-9À-ÖØ-öø-ÿ _.-]{0,22}[A-Za-z0-9À-ÖØ-öø-ÿ]$'`,
    ),
    uniqueIndex('users_public_handle_idx').on(sql`lower(${table.nickname})`, table.discriminator),
  ],
)

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert

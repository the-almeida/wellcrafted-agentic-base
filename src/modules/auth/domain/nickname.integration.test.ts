import { randomUUID } from 'node:crypto'

import { sql, TransactionRollbackError } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'

import { NicknameSchema } from './nickname'

// The database check (users_nickname_format) is the real validation: an
// anonymous sign-in goes from the browser straight to Supabase. The form's
// schema must agree with it, so both see the same cases.
const CASES: Array<[string, boolean]> = [
  ['Wolf', true],
  ['Lobo Mau', true],
  ['José', true],
  ['a.b-c_d', true],
  ['A1', true],
  ['x'.repeat(24), true],
  ['W', false],
  ['x'.repeat(25), false],
  ['-Wolf', false],
  ['Wolf-', false],
  ['Wolf!', false],
  ['Wolf 🐺', false],
  ['‮wolf', false],
  ['', false],
]

// Inserts an anonymous auth user with this nickname, as Supabase Auth would,
// in a transaction that is always rolled back. True when the database takes it.
async function databaseAccepts(nickname: string): Promise<boolean> {
  let accepted = false
  await db
    .transaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO auth.users (id, aud, role, is_anonymous, raw_user_meta_data, created_at, updated_at)
        VALUES (${randomUUID()}, 'authenticated', 'authenticated', true,
                ${JSON.stringify({ nickname })}::jsonb, now(), now())
      `)
      accepted = true
      tx.rollback()
    })
    .catch((error: unknown) => {
      if (error instanceof TransactionRollbackError) return
      const constraint = (error as { cause?: { constraint_name?: string } }).cause?.constraint_name
      if (constraint !== 'users_nickname_format') throw error
    })
  return accepted
}

describe('NicknameSchema agrees with the database check', () => {
  it.each(CASES)('%j: accepted = %s', async (nickname, expected) => {
    expect(NicknameSchema.safeParse(nickname).success).toBe(expected)
    expect(await databaseAccepts(nickname)).toBe(expected)
  })

  it('trims surrounding spaces before checking, so the stored nickname has none', () => {
    expect(NicknameSchema.parse('  Wolf  ')).toBe('Wolf')
  })
})

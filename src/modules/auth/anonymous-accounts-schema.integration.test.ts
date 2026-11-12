import { randomUUID } from 'node:crypto'

import { eq, sql, TransactionRollbackError } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { users } from '@/shared/db/schema/auth'
import { uniqueTestEmail } from '@/shared/db/test-helpers'
import { UserIdSchema, type UserId } from '@/shared/lib/ids'

// Anonymous accounts in the database: what the auth sync trigger writes to
// public.users when Supabase Auth creates (or converts) an anonymous user,
// and the constraints that hold whatever the caller sends. Users are
// inserted into auth.users with SQL, as Supabase Auth would, to stay clear
// of Supabase's 30-per-hour limit on real anonymous sign-ins; the trigger is
// what is under test.

// Deleted with SQL too: the Admin API does not find users inserted this way.
const createdUserIds: string[] = []
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}`)
  }
})

async function insertAnonymousAuthUser(metadata: Record<string, unknown>): Promise<UserId> {
  const id = UserIdSchema.parse(randomUUID())
  await db.execute(sql`
    INSERT INTO auth.users (id, aud, role, is_anonymous, raw_user_meta_data, created_at, updated_at)
    VALUES (${id}, 'authenticated', 'authenticated', true, ${JSON.stringify(metadata)}::jsonb, now(), now())
  `)
  createdUserIds.push(id)
  return id
}

const row = async (id: UserId) => (await db.select().from(users).where(eq(users.id, id)))[0]

async function authUserExists(id: UserId) {
  const rows = await db.execute(sql`SELECT 1 FROM auth.users WHERE id = ${id}`)
  return rows.length > 0
}

// The database constraint that refused a statement (Drizzle wraps the
// driver error; postgres-js puts the constraint name on it).
async function refusingConstraint(statement: Promise<unknown>): Promise<string | undefined> {
  try {
    await statement
  } catch (error) {
    return (error as { cause?: { constraint_name?: string } }).cause?.constraint_name
  }
  return undefined
}

// Runs fn in a transaction that is always rolled back.
async function inRolledBackTransaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
  let value: T | undefined
  await db
    .transaction(async (tx) => {
      value = await fn(tx as unknown as typeof db)
      tx.rollback()
    })
    .catch((error: unknown) => {
      if (!(error instanceof TransactionRollbackError)) throw error
    })
  return value as T
}

describe('anonymous accounts in public.users', () => {
  it('mirrors an anonymous auth user with its nickname and a drawn discriminator', async () => {
    const id = await insertAnonymousAuthUser({ nickname: 'Wolf' })

    const mirrored = await row(id)

    expect(mirrored).toMatchObject({
      isAnonymous: true,
      email: null,
      name: null,
      nickname: 'Wolf',
    })
    expect(mirrored?.discriminator).toBeGreaterThanOrEqual(1)
    expect(mirrored?.discriminator).toBeLessThanOrEqual(9999)
  })

  it.each([
    ['missing', {}, 'users_anonymous_has_profile'],
    ['blank', { nickname: '   ' }, 'users_nickname_format'],
    ['one character', { nickname: 'W' }, 'users_nickname_format'],
    ['25 characters', { nickname: 'W'.repeat(25) }, 'users_nickname_format'],
    ['surrounding spaces', { nickname: ' Wolf ' }, 'users_nickname_format'],
    ['a symbol', { nickname: 'Wolf<script>' }, 'users_nickname_format'],
    ['an emoji', { nickname: 'Wolf\u{1F43A}' }, 'users_nickname_format'],
    ['a bidi override', { nickname: 'Wolf‮flow' }, 'users_nickname_format'],
  ])(
    'refuses a nickname that is %s, creating no auth user either',
    async (_label, metadata, constraint) => {
      const id = UserIdSchema.parse(randomUUID())

      const refusedBy = await refusingConstraint(
        db.execute(sql`
          INSERT INTO auth.users (id, aud, role, is_anonymous, raw_user_meta_data)
          VALUES (${id}, 'authenticated', 'authenticated', true, ${JSON.stringify(metadata)}::jsonb)
        `),
      )

      expect(refusedBy).toBe(constraint)
      expect(await authUserExists(id)).toBe(false)
    },
  )

  it.each([['Lobo-Guará'], ['ana.b'], ['Zé 2'], ['abc_123'], ['Wo'], ['W'.repeat(24)]])(
    'accepts a nickname like %s',
    async (nickname) => {
      const id = await insertAnonymousAuthUser({ nickname })

      expect(await row(id)).toMatchObject({ nickname })
    },
  )

  it('draws the only free discriminator, treating nicknames case-insensitively', async () => {
    const free = await inRolledBackTransaction(async (tx) => {
      // Replica mode skips triggers and foreign keys, so 9,998 mirror rows
      // can be written directly; the transaction is rolled back.
      await tx.execute(sql`SET LOCAL session_replication_role = replica`)
      await tx.execute(sql`
        INSERT INTO public.users (id, email, name, is_anonymous, nickname, discriminator)
        SELECT gen_random_uuid(), NULL, NULL, true, 'Wolf', n
        FROM generate_series(1, 9999) AS n WHERE n <> 4321
      `)
      const [result] = await tx.execute<{ free: number | null }>(
        sql`SELECT public.free_discriminator('wOLF') AS free`,
      )
      return result?.free
    })

    expect(free).toBe(4321)
  })

  it('refuses a new account whose nickname has every discriminator taken', async () => {
    const outcome = await inRolledBackTransaction(async (tx) => {
      await tx.execute(sql`SET LOCAL session_replication_role = replica`)
      await tx.execute(sql`
        INSERT INTO public.users (id, email, name, is_anonymous, nickname, discriminator)
        SELECT gen_random_uuid(), NULL, NULL, true, 'Wolf', n FROM generate_series(1, 9999) AS n
      `)
      await tx.execute(sql`SET LOCAL session_replication_role = origin`)
      return refusingConstraint(
        tx.execute(sql`
          INSERT INTO auth.users (id, aud, role, is_anonymous, raw_user_meta_data)
          VALUES (gen_random_uuid(), 'authenticated', 'authenticated', true, '{"nickname":"wolf"}'::jsonb)
        `),
      )
    })

    // free_discriminator found no number, so the profile is incomplete.
    expect(outcome).toBe('users_profile_complete')
  })

  it('refuses a permanent account without an email', async () => {
    const id = await insertAnonymousAuthUser({ nickname: 'Fox' })

    const refusedBy = await refusingConstraint(
      db.update(users).set({ isAnonymous: false }).where(eq(users.id, id)),
    )

    expect(refusedBy).toBe('users_email_unless_anonymous')
  })

  it('refuses an anonymous admin', async () => {
    const id = await insertAnonymousAuthUser({ nickname: 'Fox' })

    const refusedBy = await refusingConstraint(
      db.update(users).set({ role: 'admin' }).where(eq(users.id, id)),
    )

    expect(refusedBy).toBe('users_anonymous_not_admin')
  })

  it('follows a conversion to a permanent account, keeping id and public profile', async () => {
    const id = await insertAnonymousAuthUser({ nickname: 'Owl' })
    const before = await row(id)
    const email = uniqueTestEmail('converted')

    // The order Supabase Auth uses: the email first, then is_anonymous.
    await db.execute(sql`UPDATE auth.users SET email = ${email} WHERE id = ${id}`)
    await db.execute(sql`UPDATE auth.users SET is_anonymous = false WHERE id = ${id}`)

    expect(await row(id)).toMatchObject({
      id,
      email,
      isAnonymous: false,
      nickname: 'Owl',
      discriminator: before?.discriminator,
    })
  })
})

import { createServerClient } from '@supabase/ssr'
import { sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import {
  cleanupAuthUser,
  createAnonSupabase,
  getAdminSupabase,
  uniqueTestEmail,
} from '@/shared/db/test-helpers'
import { env } from '@/shared/lib/env'
import { UserIdSchema, type UserId } from '@/shared/lib/ids'

import { createSupabaseAuthProvider } from '../adapters/auth-provider.supabase'
import { userRepository } from '../adapters/user-repository.drizzle'

import { secureFirstEmailProof } from './email-proof'
import { setPasswordWith } from './set-password/set-password.logic'

// The first-proof mitigation against the local Supabase stack: real
// passwords, real sessions, and Supabase Auth's own writes racing it.

const KNOWN_PASSWORD = 'set-by-someone-1'

const createdUserIds: string[] = []
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await cleanupAuthUser(id)
})

// A browser: the app's adapter over an in-memory cookie jar.
function browser() {
  const jar = new Map<string, string>()
  const client = () =>
    createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const { name, value } of cookies) {
            if (value) jar.set(name, value)
            else jar.delete(name)
          }
        },
      },
    })
  return createSupabaseAuthProvider(async () => client())
}

// An account whose password was set by someone who may not own the email
// (Confirm email is off), created an hour ago, with the email not proven yet.
async function unverifiedAccount(): Promise<{ id: UserId; email: string }> {
  const email = uniqueTestEmail('first-proof')
  const { data, error } = await getAdminSupabase().auth.admin.createUser({
    email,
    password: KNOWN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'First proof' },
  })
  if (error || !data.user) throw error ?? new Error('user not returned')
  const id = UserIdSchema.parse(data.user.id)
  createdUserIds.push(id)
  await db.execute(
    sql`UPDATE public.users SET created_at = now() - interval '1 hour' WHERE id = ${id}`,
  )
  return { id, email }
}

// The person who proved the email, signed in on the app.
async function provenIn(email: string) {
  const here = browser()
  const signedIn = await here.signInWithPassword({ email, password: KNOWN_PASSWORD })
  if (!signedIn.ok) throw signedIn.error
  return here
}

async function knownPasswordWorks(email: string) {
  const { error } = await createAnonSupabase().auth.signInWithPassword({
    email,
    password: KNOWN_PASSWORD,
  })
  return error === null
}

async function sessionCount(id: UserId) {
  const rows = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM auth.sessions WHERE user_id = ${id}`,
  )
  return rows[0]?.n
}

describe('secureFirstEmailProof, against Supabase Auth', () => {
  it('replaces the password, ends every other session and records the proof', async () => {
    const account = await unverifiedAccount()
    const elsewhere = createAnonSupabase()
    await elsewhere.auth.signInWithPassword({ email: account.email, password: KNOWN_PASSWORD })
    const here = await provenIn(account.email)

    const result = await secureFirstEmailProof(here, account.id, account.email)

    expect(result).toEqual({ ok: true, value: { mustSetPassword: true } })
    expect((await elsewhere.auth.getUser()).data.user).toBeNull()
    expect(await here.getCurrentIdentity()).toMatchObject({ userId: account.id })
    expect(await knownPasswordWorks(account.email)).toBe(false)
    expect((await userRepository.findById(account.id))?.emailVerifiedAt).toBeInstanceOf(Date)
  })

  // A request from the other session that passed Supabase's session check
  // just before the proof reaches the database just after it. Supabase
  // writes the new password there with no check of its own.
  it('refuses a password change that reaches the database right after the proof', async () => {
    const account = await unverifiedAccount()
    const here = await provenIn(account.email)

    await secureFirstEmailProof(here, account.id, account.email)

    await expect(
      db.execute(
        sql`UPDATE auth.users SET encrypted_password = extensions.crypt(${KNOWN_PASSWORD}, extensions.gen_salt('bf'))
            WHERE id = ${account.id}`,
      ),
    ).rejects.toThrow()
    expect(await knownPasswordWorks(account.email)).toBe(false)
  })

  // Same for a sign-in that checked the old password just before the
  // proof: it must not open a session after it. A code generated before
  // the proof stands in for that sign-in.
  it('refuses a sign-in that reaches the database right after the proof', async () => {
    const account = await unverifiedAccount()
    const { data } = await getAdminSupabase().auth.admin.generateLink({
      type: 'magiclink',
      email: account.email,
    })
    const here = await provenIn(account.email)

    await secureFirstEmailProof(here, account.id, account.email)

    const late = await createAnonSupabase().auth.verifyOtp({
      email: account.email,
      token: data.properties?.email_otp ?? '',
      type: 'email',
    })
    expect(late.data.session).toBeNull()
    expect(await sessionCount(account.id)).toBe(1)
  })

  it('asks the person to wait a moment before choosing a password', async () => {
    const account = await unverifiedAccount()
    const here = await provenIn(account.email)
    await secureFirstEmailProof(here, account.id, account.email)

    const result = await setPasswordWith({ authProvider: here }, account.id, {
      password: 'my-own-choice-1',
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'RATE_LIMIT_EXCEEDED' } })
  })

  it('lets the account change again once the moment has passed', async () => {
    const account = await unverifiedAccount()
    const here = await provenIn(account.email)
    await secureFirstEmailProof(here, account.id, account.email)
    await db.execute(
      sql`UPDATE public.users SET auth_locked_until = now() - interval '1 second' WHERE id = ${account.id}`,
    )

    const result = await setPasswordWith({ authProvider: here }, account.id, {
      password: 'my-own-choice-1',
    })

    expect(result).toEqual({ ok: true, value: undefined })
    const { error } = await createAnonSupabase().auth.signInWithPassword({
      email: account.email,
      password: 'my-own-choice-1',
    })
    expect(error).toBeNull()
  })

  it('leaves an account whose email was already proven alone', async () => {
    const account = await unverifiedAccount()
    await db.execute(
      sql`UPDATE public.users SET email_verified_at = now() WHERE id = ${account.id}`,
    )
    const elsewhere = createAnonSupabase()
    await elsewhere.auth.signInWithPassword({ email: account.email, password: KNOWN_PASSWORD })
    const here = await provenIn(account.email)

    const result = await secureFirstEmailProof(here, account.id, account.email)

    expect(result).toEqual({ ok: true, value: { mustSetPassword: false } })
    expect((await elsewhere.auth.getUser()).data.user).not.toBeNull()
    expect(await knownPasswordWorks(account.email)).toBe(true)
  })
})

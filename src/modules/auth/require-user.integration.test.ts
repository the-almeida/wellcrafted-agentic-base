import { randomUUID } from 'node:crypto'

import { eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/shared/db/client'
import { accountDeletionRequests, users } from '@/shared/db/schema'
import { cleanupAuthUser, getAdminSupabase, uniqueTestEmail } from '@/shared/db/test-helpers'
import {
  AccountPendingDeletionError,
  PermanentAccountRequiredError,
  UnauthenticatedError,
} from '@/shared/lib/errors/base'
import { UserIdSchema, type UserId } from '@/shared/lib/ids'

import { authProvider } from './adapters/auth-provider.supabase'
import { openDeletionRequest } from './features/account-deletion/deletion-requests'
import { getOptionalUser } from './get-optional-user'
import { requireUser } from './require-user'

// Port boundary: local tests cannot hold a Supabase session cookie in
// next/headers, so the current identity is stubbed. Everything else is real.
function signedInAs(userId: UserId | null) {
  vi.spyOn(authProvider, 'getCurrentIdentity').mockResolvedValue(
    userId ? { userId, email: 'stubbed@example.test', isAnonymous: false } : null,
  )
}

let createdUserIds: UserId[] = []
let anonymousUserIds: UserId[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const userId of createdUserIds) {
    await db.delete(accountDeletionRequests).where(eq(accountDeletionRequests.userId, userId))
    await cleanupAuthUser(userId)
  }
  createdUserIds = []
  // Inserted with SQL (the Admin API does not find them), so deleted with SQL.
  for (const userId of anonymousUserIds) {
    await db.execute(sql`DELETE FROM auth.users WHERE id = ${userId}`)
  }
  anonymousUserIds = []
})

async function seedUser(): Promise<UserId> {
  const { data, error } = await getAdminSupabase().auth.admin.createUser({
    email: uniqueTestEmail('require-user'),
    email_confirm: true,
    user_metadata: { name: 'Require user' },
  })
  if (error || !data.user) throw error ?? new Error('user not returned')
  const userId = UserIdSchema.parse(data.user.id)
  createdUserIds.push(userId)
  return userId
}

async function seedPendingUser(): Promise<{ userId: UserId; scheduledFor: Date }> {
  const userId = await seedUser()
  const request = await openDeletionRequest(userId, 'user')
  return { userId, scheduledFor: request.scheduledFor }
}

// Inserted into auth.users with SQL, as Supabase Auth does on an anonymous
// sign-in (real ones are limited per IP); the trigger creates the profile.
async function seedAnonymousUser(): Promise<UserId> {
  const userId = UserIdSchema.parse(randomUUID())
  await db.execute(sql`
    INSERT INTO auth.users (id, aud, role, is_anonymous, raw_user_meta_data, created_at, updated_at)
    VALUES (${userId}, 'authenticated', 'authenticated', true, '{"nickname":"Wolf"}'::jsonb, now(), now())
  `)
  anonymousUserIds.push(userId)
  return userId
}

const ACCESS_LEVELS = [
  undefined,
  { allow: ['anonymous' as const] },
  { allow: ['pending-deletion' as const] },
  { allow: ['anonymous' as const, 'pending-deletion' as const] },
]

describe('requireUser', () => {
  it.each(ACCESS_LEVELS)('rejects a caller with no session (%o)', async (options) => {
    signedInAs(null)

    const result = await requireUser(options)

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        constructor: UnauthenticatedError,
        message: 'not authenticated',
      }),
    })
  })

  it.each(ACCESS_LEVELS)('rejects a session with no public.users row (%o)', async (options) => {
    signedInAs(UserIdSchema.parse(randomUUID()))

    const result = await requireUser(options)

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        constructor: UnauthenticatedError,
        message: 'user record not found',
      }),
    })
  })

  it.each(ACCESS_LEVELS)('lets an active account through (%o)', async (options) => {
    const userId = await seedUser()
    signedInAs(userId)

    const result = await requireUser(options)

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ id: userId, isAnonymous: false, pendingDeletion: null }),
    })
  })

  it.each([undefined, { allow: ['anonymous' as const] }])(
    'rejects an account pending deletion unless pending-deletion is allowed (%o)',
    async (options) => {
      const { userId, scheduledFor } = await seedPendingUser()
      signedInAs(userId)

      const result = await requireUser(options)

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({ constructor: AccountPendingDeletionError, scheduledFor }),
      })
    },
  )

  it('lets an account pending deletion through when pending-deletion is allowed', async () => {
    const { userId, scheduledFor } = await seedPendingUser()
    signedInAs(userId)

    const result = await requireUser({ allow: ['pending-deletion'] })

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ id: userId, pendingDeletion: { scheduledFor } }),
    })
  })

  it('rejects a pending admin too: the role does not bypass the access level', async () => {
    const { userId } = await seedPendingUser()
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, userId))
    signedInAs(userId)

    const result = await requireUser()

    expect(result).toEqual({ ok: false, error: expect.any(AccountPendingDeletionError) })
  })

  it.each([undefined, { allow: ['pending-deletion' as const] }])(
    'rejects an anonymous account unless anonymous is allowed (%o)',
    async (options) => {
      signedInAs(await seedAnonymousUser())

      const result = await requireUser(options)

      expect(result).toEqual({ ok: false, error: expect.any(PermanentAccountRequiredError) })
    },
  )

  it('lets an active anonymous account through when anonymous is allowed', async () => {
    const userId = await seedAnonymousUser()
    signedInAs(userId)

    const result = await requireUser({ allow: ['anonymous'] })

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        id: userId,
        isAnonymous: true,
        email: null,
        name: null,
        profile: { nickname: 'Wolf', discriminator: expect.any(Number) },
        emailVerifiedAt: null,
      }),
    })
  })

  async function seedPendingAnonymousUser(): Promise<UserId> {
    const userId = await seedAnonymousUser()
    await openDeletionRequest(userId, 'user')
    return userId
  }

  it('rejects an anonymous account pending deletion when only anonymous is allowed', async () => {
    signedInAs(await seedPendingAnonymousUser())

    expect(await requireUser({ allow: ['anonymous'] })).toEqual({
      ok: false,
      error: expect.any(AccountPendingDeletionError),
    })
  })

  it('reports the anonymous rule first when both rules fail', async () => {
    signedInAs(await seedPendingAnonymousUser())

    expect(await requireUser()).toEqual({
      ok: false,
      error: expect.any(PermanentAccountRequiredError),
    })
  })

  it('lets an anonymous account pending deletion through when both are allowed', async () => {
    const userId = await seedPendingAnonymousUser()
    signedInAs(userId)

    expect(await requireUser({ allow: ['anonymous', 'pending-deletion'] })).toEqual({
      ok: true,
      value: expect.objectContaining({ id: userId, isAnonymous: true }),
    })
  })

  it('lets a converted account (permanent now, nickname only) through by default', async () => {
    const userId = await seedAnonymousUser()
    await db.execute(sql`
      UPDATE auth.users SET email = ${uniqueTestEmail('converted')}, is_anonymous = false
      WHERE id = ${userId}
    `)
    signedInAs(userId)

    const result = await requireUser()

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        id: userId,
        isAnonymous: false,
        name: null,
        profile: expect.objectContaining({ nickname: 'Wolf' }),
      }),
    })
  })
})

describe('getOptionalUser', () => {
  it('returns null with no session', async () => {
    signedInAs(null)

    expect(await getOptionalUser()).toBeNull()
  })

  it('returns null for a session with no public.users row', async () => {
    signedInAs(UserIdSchema.parse(randomUUID()))

    expect(await getOptionalUser()).toBeNull()
  })

  it('returns an anonymous account', async () => {
    const userId = await seedAnonymousUser()
    signedInAs(userId)

    expect(await getOptionalUser()).toMatchObject({ id: userId, isAnonymous: true })
  })

  it('returns an account pending deletion without gating it', async () => {
    const { userId, scheduledFor } = await seedPendingUser()
    signedInAs(userId)

    expect(await getOptionalUser()).toMatchObject({ id: userId, pendingDeletion: { scheduledFor } })
  })
})

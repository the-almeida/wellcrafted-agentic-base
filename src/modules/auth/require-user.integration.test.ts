import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/shared/db/client'
import { accountDeletionRequests, users } from '@/shared/db/schema'
import { cleanupAuthUser, getAdminSupabase, uniqueTestEmail } from '@/shared/db/test-helpers'
import { AccountPendingDeletionError, UnauthenticatedError } from '@/shared/lib/errors/base'
import { UserIdSchema, type UserId } from '@/shared/lib/ids'

import { authProvider } from './adapters/auth-provider.supabase'
import { openDeletionRequest } from './features/account-deletion/deletion-requests'
import { getOptionalUser } from './get-optional-user'
import { requireUser } from './require-user'

// Port boundary: local tests cannot hold a Supabase session cookie in
// next/headers, so the current identity is stubbed. Everything else is real.
function signedInAs(userId: UserId | null) {
  vi.spyOn(authProvider, 'getCurrentIdentity').mockResolvedValue(
    userId ? { userId, email: 'stubbed@example.test' } : null,
  )
}

let createdUserIds: UserId[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const userId of createdUserIds) {
    await db.delete(accountDeletionRequests).where(eq(accountDeletionRequests.userId, userId))
    await cleanupAuthUser(userId)
  }
  createdUserIds = []
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

const ACCESS_LEVELS = [undefined, { access: 'grace-period' as const }]

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
      value: expect.objectContaining({ id: userId, pendingDeletion: null }),
    })
  })

  it.each([undefined, { access: 'full' as const }])(
    'rejects an account pending deletion by default and with full access (%o)',
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

  it('lets an account pending deletion through during the grace period', async () => {
    const { userId, scheduledFor } = await seedPendingUser()
    signedInAs(userId)

    const result = await requireUser({ access: 'grace-period' })

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

  it('returns an account pending deletion without gating it', async () => {
    const { userId, scheduledFor } = await seedPendingUser()
    signedInAs(userId)

    expect(await getOptionalUser()).toMatchObject({ id: userId, pendingDeletion: { scheduledFor } })
  })
})

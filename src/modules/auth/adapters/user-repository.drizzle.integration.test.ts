import { randomUUID } from 'node:crypto'

import { eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { accountDeletionRequests } from '@/shared/db/schema'
import { cleanupAuthUser, getAdminSupabase, uniqueTestEmail } from '@/shared/db/test-helpers'
import { UserIdSchema, type AccountDeletionRequestId, type UserId } from '@/shared/lib/ids'

import {
  openDeletionRequest,
  type DeletionRequestSource,
} from '../features/account-deletion/deletion-requests'

import { userRepository } from './user-repository.drizzle'

let createdUserIds: UserId[] = []

afterEach(async () => {
  for (const userId of createdUserIds) {
    await db.delete(accountDeletionRequests).where(eq(accountDeletionRequests.userId, userId))
    await cleanupAuthUser(userId)
  }
  createdUserIds = []
})

// The auth trigger creates the matching public.users row.
async function seedUser(): Promise<UserId> {
  const { data, error } = await getAdminSupabase().auth.admin.createUser({
    email: uniqueTestEmail('repo'),
    email_confirm: true,
    user_metadata: { name: 'Repo test' },
  })
  if (error || !data.user) throw error ?? new Error('user not returned')
  const userId = UserIdSchema.parse(data.user.id)
  createdUserIds.push(userId)
  return userId
}

async function closeRequest(id: AccountDeletionRequestId, how: 'cancelledAt' | 'completedAt') {
  await db
    .update(accountDeletionRequests)
    .set(how === 'cancelledAt' ? { cancelledAt: new Date() } : { completedAt: new Date() })
    .where(eq(accountDeletionRequests.id, id))
}

describe('userRepository.findById', () => {
  it('returns an account with no deletion requests as not pending', async () => {
    const userId = await seedUser()

    const user = await userRepository.findById(userId)

    expect(user).toMatchObject({
      id: userId,
      name: 'Repo test',
      isAnonymous: false,
      profile: null,
      pendingDeletion: null,
    })
  })

  it('returns a new account as not having verified its email', async () => {
    // Supabase confirms the email of admin-created users, but only the app
    // records a verification the person actually made (code or OAuth).
    const userId = await seedUser()

    expect(await userRepository.findById(userId)).toMatchObject({ emailVerifiedAt: null })
  })

  it.each<DeletionRequestSource>(['user', 'facebook'])(
    'returns the scheduled date of an active request opened by %s',
    async (source) => {
      const userId = await seedUser()
      const request = await openDeletionRequest(userId, source)

      const user = await userRepository.findById(userId)

      expect(user?.pendingDeletion).toEqual({ scheduledFor: request.scheduledFor })
    },
  )

  it.each(['cancelledAt', 'completedAt'] as const)(
    'still finds a user whose only request has %s set, as not pending',
    async (how) => {
      const userId = await seedUser()
      await closeRequest((await openDeletionRequest(userId, 'user')).id, how)

      const user = await userRepository.findById(userId)

      expect(user).toMatchObject({ id: userId, pendingDeletion: null })
    },
  )

  it('returns the active request when cancelled ones exist too', async () => {
    const userId = await seedUser()
    for (let i = 0; i < 2; i++) {
      await closeRequest((await openDeletionRequest(userId, 'user')).id, 'cancelledAt')
    }
    const active = await openDeletionRequest(userId, 'user')

    const user = await userRepository.findById(userId)

    expect(user).toMatchObject({
      id: userId,
      pendingDeletion: { scheduledFor: active.scheduledFor },
    })
  })

  it('keeps an active request past its scheduled date as pending until the purge runs', async () => {
    const userId = await seedUser()
    const request = await openDeletionRequest(userId, 'user')
    const past = new Date(Date.now() - 60_000)
    await db
      .update(accountDeletionRequests)
      .set({ scheduledFor: past })
      .where(eq(accountDeletionRequests.id, request.id))

    const user = await userRepository.findById(userId)

    expect(user?.pendingDeletion).toEqual({ scheduledFor: past })
  })

  it('returns an anonymous account with its public profile and no email', async () => {
    const id = UserIdSchema.parse(randomUUID())
    await db.execute(sql`
      INSERT INTO auth.users (id, aud, role, is_anonymous, raw_user_meta_data)
      VALUES (${id}, 'authenticated', 'authenticated', true, '{"nickname":"Repo anon"}'::jsonb)
    `)
    try {
      const user = await userRepository.findById(id)

      expect(user).toMatchObject({
        id,
        isAnonymous: true,
        email: null,
        name: null,
        emailVerifiedAt: null,
        profile: { nickname: 'Repo anon', discriminator: expect.any(Number) },
      })
    } finally {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}`)
    }
  })

  it('returns null for an unknown id', async () => {
    expect(await userRepository.findById(UserIdSchema.parse(randomUUID()))).toBeNull()
  })
})

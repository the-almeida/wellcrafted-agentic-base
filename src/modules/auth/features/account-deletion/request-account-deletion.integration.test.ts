import { eq, inArray } from 'drizzle-orm'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { accountDeletionRequests } from '@/shared/db/schema'
import { cleanupAuthUser, getAdminSupabase, uniqueTestEmail } from '@/shared/db/test-helpers'
import {
  AccountDeletionRequestIdSchema,
  UserIdSchema,
  type AccountDeletionRequestId,
} from '@/shared/lib/ids'

import type { User } from '../../domain/user'

import { requestAccountDeletionForUser } from './request-account-deletion.logic'

describe('requestAccountDeletionForUser', () => {
  let createdUserIds: string[] = []
  let createdRequestIds: AccountDeletionRequestId[] = []

  beforeAll(() => {
    getAdminSupabase()
  })

  afterEach(async () => {
    if (createdRequestIds.length > 0) {
      await db
        .delete(accountDeletionRequests)
        .where(inArray(accountDeletionRequests.id, createdRequestIds))
    }
    createdRequestIds = []
    for (const id of createdUserIds) {
      await cleanupAuthUser(id)
    }
    createdUserIds = []
  })

  async function seedUser(prefix: string): Promise<User> {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail(prefix),
      email_confirm: true,
      user_metadata: { name: `Logic ${prefix}` },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    createdUserIds.push(data.user.id)
    return {
      id: UserIdSchema.parse(data.user.id),
      email: data.user.email!,
      name: `Logic ${prefix}`,
      role: 'user' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  it('inserts an active deletion request scheduled 30 days out', async () => {
    const user: User = await seedUser('happy')
    const before = Date.now()

    const result = await requestAccountDeletionForUser(user)

    expect(result.ok).toBe(true)
    if (!result.ok) throw result.error
    const row = result.value
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(row.id))

    expect(row.userId).toBe(user.id)
    expect(row.source).toBe('user')
    expect(row.cancelledAt).toBeNull()
    expect(row.completedAt).toBeNull()
    expect(row.confirmationCode).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(row.confirmationCode.length).toBeGreaterThanOrEqual(20)

    // Scheduled ~30 days out (allow 2 minutes of slack for clock skew / test timing).
    const expectedMs = before + 30 * 24 * 60 * 60 * 1000
    const slack = 2 * 60 * 1000
    expect(row.scheduledFor.getTime()).toBeGreaterThanOrEqual(expectedMs - slack)
    expect(row.scheduledFor.getTime()).toBeLessThanOrEqual(expectedMs + slack + 60_000)
  })

  it('is idempotent when an active deletion request already exists', async () => {
    const user = await seedUser('idempotent')

    const first = await requestAccountDeletionForUser(user)
    if (!first.ok) throw first.error
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(first.value.id))

    const second = await requestAccountDeletionForUser(user)
    if (!second.ok) throw second.error

    expect(second.value.id).toBe(first.value.id)
    expect(second.value.confirmationCode).toBe(first.value.confirmationCode)

    const rows = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, user.id))
    expect(rows).toHaveLength(1)
  })

  it('creates a new active request when the previous one was cancelled', async () => {
    const user = await seedUser('after-cancel')

    const first = await requestAccountDeletionForUser(user)
    if (!first.ok) throw first.error
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(first.value.id))

    await db
      .update(accountDeletionRequests)
      .set({ cancelledAt: new Date() })
      .where(eq(accountDeletionRequests.id, first.value.id))

    const second = await requestAccountDeletionForUser(user)
    if (!second.ok) throw second.error
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(second.value.id))

    expect(second.value.id).not.toBe(first.value.id)
    expect(second.value.cancelledAt).toBeNull()
    expect(second.value.confirmationCode).not.toBe(first.value.confirmationCode)
  })

  it('is concurrency-safe: parallel requests from the same user return the same row', async () => {
    const user = await seedUser('concurrent')

    const [a, b] = await Promise.all([
      requestAccountDeletionForUser(user),
      requestAccountDeletionForUser(user),
    ])
    if (!a.ok) throw a.error
    if (!b.ok) throw b.error
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(a.value.id))

    expect(a.value.id).toBe(b.value.id)
    expect(a.value.confirmationCode).toBe(b.value.confirmationCode)

    const rows = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, user.id))
    expect(rows).toHaveLength(1)
  })
})

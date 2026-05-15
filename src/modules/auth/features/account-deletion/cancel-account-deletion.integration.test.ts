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

import { cancelAccountDeletionForUser } from './cancel-account-deletion.logic'
import { requestAccountDeletionForUser } from './request-account-deletion.logic'

describe('cancelAccountDeletionForUser', () => {
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
      user_metadata: { name: `Cancel ${prefix}` },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    createdUserIds.push(data.user.id)
    return {
      id: UserIdSchema.parse(data.user.id),
      email: data.user.email!,
      name: `Cancel ${prefix}`,
      role: 'user' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  it("marks the user's active deletion request as cancelled", async () => {
    const user = await seedUser('happy')
    const requested = await requestAccountDeletionForUser(user)
    if (!requested.ok) throw requested.error
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(requested.value.id))

    const before = Date.now()
    const result = await cancelAccountDeletionForUser(user)
    expect(result.ok).toBe(true)
    if (!result.ok) throw result.error

    expect(result.value.id).toBe(requested.value.id)
    expect(result.value.cancelledAt).toBeInstanceOf(Date)
    expect(result.value.cancelledAt!.getTime()).toBeGreaterThanOrEqual(before - 1000)

    const [row] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, requested.value.id))
    expect(row?.cancelledAt).not.toBeNull()
  })

  it('returns NotFoundError when the user has no active deletion request', async () => {
    const user = await seedUser('nothing-to-cancel')

    const result = await cancelAccountDeletionForUser(user)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns NotFoundError when the previous request was already cancelled', async () => {
    const user = await seedUser('already-cancelled')
    const requested = await requestAccountDeletionForUser(user)
    if (!requested.ok) throw requested.error
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(requested.value.id))

    const first = await cancelAccountDeletionForUser(user)
    expect(first.ok).toBe(true)

    const second = await cancelAccountDeletionForUser(user)
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error('expected error')
    expect(second.error.code).toBe('NOT_FOUND')
  })

  it("cannot cancel another user's active deletion request", async () => {
    const owner = await seedUser('owner')
    const stranger = await seedUser('stranger')

    const ownerRequest = await requestAccountDeletionForUser(owner)
    if (!ownerRequest.ok) throw ownerRequest.error
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(ownerRequest.value.id))

    const result = await cancelAccountDeletionForUser(stranger)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('stranger should not have been able to cancel')
    expect(result.error.code).toBe('NOT_FOUND')

    const [row] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, ownerRequest.value.id))
    expect(row?.cancelledAt).toBeNull()
  })
})

import { randomUUID } from 'node:crypto'

import { inArray } from 'drizzle-orm'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { accountDeletionRequests } from '@/shared/db/schema'
import {
  cleanupAuthUser,
  createAnonSupabase,
  getAdminSupabase,
  uniqueTestEmail,
} from '@/shared/db/test-helpers'
import {
  AccountDeletionRequestIdSchema,
  UserIdSchema,
  type AccountDeletionRequestId,
  type UserId,
} from '@/shared/lib/ids'

describe('account_deletion_requests RLS', () => {
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

  async function seedAuthenticatedUser(prefix: string) {
    const supabase = getAdminSupabase()
    const password = `pw-${randomUUID()}`
    const email = uniqueTestEmail(prefix)
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: `RLS ${prefix}` },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    createdUserIds.push(data.user.id)

    const anon = createAnonSupabase()
    const signIn = await anon.auth.signInWithPassword({ email, password })
    expect(signIn.error).toBeNull()

    return {
      userId: UserIdSchema.parse(data.user.id),
      client: anon,
    }
  }

  async function seedDeletionRequest(userId: UserId) {
    const [row] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        source: 'user',
        confirmationCode: randomUUID(),
      })
      .returning()
    const id = AccountDeletionRequestIdSchema.parse(row!.id)
    createdRequestIds.push(id)
    return row!
  }

  it('lets an authenticated user read their own deletion request', async () => {
    const { userId, client } = await seedAuthenticatedUser('owner-read')
    const seeded = await seedDeletionRequest(userId)

    const { data, error } = await client
      .from('account_deletion_requests')
      .select('id, user_id, confirmation_code')
      .eq('id', seeded.id)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0]!.id).toBe(seeded.id)
    expect(data![0]!.user_id).toBe(userId)
  })

  it("hides another user's deletion request from an authenticated user", async () => {
    const owner = await seedAuthenticatedUser('owner-hidden')
    const stranger = await seedAuthenticatedUser('stranger')
    const ownersRequest = await seedDeletionRequest(owner.userId)

    const { data, error } = await stranger.client
      .from('account_deletion_requests')
      .select('id')
      .eq('id', ownersRequest.id)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('rejects an authenticated INSERT into account_deletion_requests', async () => {
    const { userId, client } = await seedAuthenticatedUser('cannot-insert')

    const { error } = await client.from('account_deletion_requests').insert({
      user_id: userId,
      scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'user',
      confirmation_code: randomUUID(),
    })

    expect(error).not.toBeNull()
  })

  it("rejects an authenticated UPDATE on the user's own deletion request", async () => {
    const { userId, client } = await seedAuthenticatedUser('cannot-update')
    const seeded = await seedDeletionRequest(userId)

    const { error } = await client
      .from('account_deletion_requests')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', seeded.id)
      .select()

    // Either the request errors, or RLS hides all rows so 0 are updated.
    // Both outcomes mean the user cannot mutate the row directly.
    const { data: rowAfter } = await getAdminSupabase()
      .from('account_deletion_requests')
      .select('cancelled_at')
      .eq('id', seeded.id)
      .single()
    expect(rowAfter?.cancelled_at).toBeNull()
    expect(error !== null || rowAfter?.cancelled_at === null).toBe(true)
  })

  it("rejects an authenticated DELETE on the user's own deletion request", async () => {
    const { userId, client } = await seedAuthenticatedUser('cannot-delete')
    const seeded = await seedDeletionRequest(userId)

    await client.from('account_deletion_requests').delete().eq('id', seeded.id)

    const { data: rowAfter } = await getAdminSupabase()
      .from('account_deletion_requests')
      .select('id')
      .eq('id', seeded.id)
      .single()
    expect(rowAfter?.id).toBe(seeded.id)
  })
})

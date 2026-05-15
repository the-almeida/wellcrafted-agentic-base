import { randomUUID } from 'node:crypto'

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

describe('account_deletion_requests schema', () => {
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

  async function seedUser(prefix: string) {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail(prefix),
      email_confirm: true,
      user_metadata: { name: `Test ${prefix}` },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    createdUserIds.push(data.user.id)
    return UserIdSchema.parse(data.user.id)
  }

  function thirtyDaysFromNow() {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }

  it('persists an active deletion request with defaults populated', async () => {
    const userId = await seedUser('deletion')

    const inserted = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: thirtyDaysFromNow(),
        source: 'user',
        confirmationCode: randomUUID(),
      })
      .returning()

    expect(inserted).toHaveLength(1)
    const row = inserted[0]!
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(row.id))

    expect(row.userId).toBe(userId)
    expect(row.source).toBe('user')
    expect(row.cancelledAt).toBeNull()
    expect(row.completedAt).toBeNull()
    expect(row.requestedAt).toBeInstanceOf(Date)
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/)

    const fetched = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, row.id))
    expect(fetched).toHaveLength(1)
  })

  it('rejects a second active deletion request for the same user', async () => {
    const userId = await seedUser('dup-active')

    const [first] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: thirtyDaysFromNow(),
        source: 'user',
        confirmationCode: randomUUID(),
      })
      .returning()
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(first!.id))

    await expect(
      db.insert(accountDeletionRequests).values({
        userId,
        scheduledFor: thirtyDaysFromNow(),
        source: 'facebook',
        confirmationCode: randomUUID(),
      }),
    ).rejects.toThrow()

    const rowsForUser = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, userId))
    expect(rowsForUser).toHaveLength(1)
  })

  it('allows a new active request once the previous one is cancelled', async () => {
    const userId = await seedUser('after-cancel')

    const [first] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: thirtyDaysFromNow(),
        source: 'user',
        confirmationCode: randomUUID(),
      })
      .returning()
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(first!.id))

    await db
      .update(accountDeletionRequests)
      .set({ cancelledAt: new Date() })
      .where(eq(accountDeletionRequests.id, first!.id))

    const [second] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: thirtyDaysFromNow(),
        source: 'user',
        confirmationCode: randomUUID(),
      })
      .returning()
    expect(second).toBeDefined()
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(second!.id))
    expect(second!.cancelledAt).toBeNull()
  })

  it('allows a new active request once the previous one is completed', async () => {
    const userId = await seedUser('after-complete')

    const [first] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: thirtyDaysFromNow(),
        source: 'user',
        confirmationCode: randomUUID(),
      })
      .returning()
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(first!.id))

    await db
      .update(accountDeletionRequests)
      .set({ completedAt: new Date() })
      .where(eq(accountDeletionRequests.id, first!.id))

    const [second] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: thirtyDaysFromNow(),
        source: 'user',
        confirmationCode: randomUUID(),
      })
      .returning()
    expect(second).toBeDefined()
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(second!.id))
  })

  it('keeps the deletion request row as an audit trail after the user is purged', async () => {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail('audit'),
      email_confirm: true,
      user_metadata: { name: 'Audit Trail' },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    const userId = UserIdSchema.parse(data.user.id)

    const [row] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: thirtyDaysFromNow(),
        source: 'user',
        confirmationCode: randomUUID(),
      })
      .returning()
    const requestId = AccountDeletionRequestIdSchema.parse(row!.id)
    createdRequestIds.push(requestId)

    await supabase.auth.admin.deleteUser(data.user.id)

    const fetched = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, requestId))
    expect(fetched).toHaveLength(1)
    expect(fetched[0]!.userId).toBeNull()
    expect(fetched[0]!.confirmationCode).toBe(row!.confirmationCode)
  })
})

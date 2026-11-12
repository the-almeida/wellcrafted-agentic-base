import { eq, inArray, sql } from 'drizzle-orm'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { accountDeletionRequests, exampleEntities, users } from '@/shared/db/schema'
import { cleanupAuthUser, getAdminSupabase, uniqueTestEmail } from '@/shared/db/test-helpers'
import {
  AccountDeletionRequestIdSchema,
  UserIdSchema,
  type AccountDeletionRequestId,
  type UserId,
} from '@/shared/lib/ids'

async function runPurge() {
  await db.execute(sql`SELECT purge_expired_account_deletions()`)
}

describe('purge_expired_account_deletions()', () => {
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

  async function seedUser(prefix: string): Promise<UserId> {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail(prefix),
      email_confirm: true,
      user_metadata: { name: `Purge ${prefix}` },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    createdUserIds.push(data.user.id)
    return UserIdSchema.parse(data.user.id)
  }

  async function seedExpiredRequest(userId: UserId) {
    const [row] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: new Date(Date.now() - 60_000),
        source: 'user',
        confirmationCode: `expired-${userId}`,
      })
      .returning()
    const id = AccountDeletionRequestIdSchema.parse(row!.id)
    createdRequestIds.push(id)
    return row!
  }

  it('deletes the user and marks the request completed when scheduled_for has passed', async () => {
    const userId = await seedUser('expired')
    await db.insert(exampleEntities).values({ userId, title: 'cascade-target', description: null })
    const request = await seedExpiredRequest(userId)

    await runPurge()

    const remainingUser = await db.select().from(users).where(eq(users.id, userId))
    expect(remainingUser).toHaveLength(0)

    const cascadeRows = await db
      .select()
      .from(exampleEntities)
      .where(eq(exampleEntities.userId, userId))
    expect(cascadeRows).toHaveLength(0)

    const [updatedRequest] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, request.id))
    expect(updatedRequest).toBeDefined()
    expect(updatedRequest!.completedAt).not.toBeNull()
    expect(updatedRequest!.userId).toBeNull()
  })

  it('is a no-op when no requests have expired', async () => {
    const userId = await seedUser('not-yet')
    const [row] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
        source: 'user',
        confirmationCode: `future-${userId}`,
      })
      .returning()
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(row!.id))

    await runPurge()

    const [unchanged] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, row!.id))
    expect(unchanged?.completedAt).toBeNull()

    const remainingUser = await db.select().from(users).where(eq(users.id, userId))
    expect(remainingUser).toHaveLength(1)
  })

  it('does not purge a cancelled request even when scheduled_for is in the past', async () => {
    const userId = await seedUser('cancelled')
    const [row] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: new Date(Date.now() - 60_000),
        cancelledAt: new Date(Date.now() - 30_000),
        source: 'user',
        confirmationCode: `cancelled-${userId}`,
      })
      .returning()
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(row!.id))

    await runPurge()

    const [unchanged] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, row!.id))
    expect(unchanged?.completedAt).toBeNull()

    const remainingUser = await db.select().from(users).where(eq(users.id, userId))
    expect(remainingUser).toHaveLength(1)
  })

  it('still completes the request when the auth user is already gone', async () => {
    const userId = await seedUser('preempted')
    const request = await seedExpiredRequest(userId)

    // Simulate manual prior cleanup of the auth user (mirrors what
    // happens if an admin uses Supabase Studio to delete the user
    // between scheduling and purge time).
    const supabase = getAdminSupabase()
    await supabase.auth.admin.deleteUser(userId)
    // The user is now gone; drop the id from cleanup tracking so
    // afterEach doesn't 404 on a second delete attempt.
    createdUserIds = createdUserIds.filter((id) => id !== userId)

    await runPurge()

    const [updatedRequest] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, request.id))
    expect(updatedRequest?.completedAt).not.toBeNull()
  })

  it('skips a request another transaction is processing instead of waiting for it', async () => {
    const userId = await seedUser('locked')
    const request = await seedExpiredRequest(userId)

    // Hold the row lock the way a concurrent purge run would, then purge
    // from another connection. With `FOR UPDATE SKIP LOCKED` the purge
    // skips the row; without it, it waits and `lock_timeout` fails it.
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    let holding!: () => void
    const held = new Promise<void>((resolve) => (holding = resolve))
    const holder = db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM account_deletion_requests WHERE id = ${request.id} FOR UPDATE`,
      )
      holding()
      await released
    })

    // If the holder fails before locking, surface its error instead of
    // waiting forever on `held`.
    await Promise.race([
      held,
      holder.then(() => {
        throw new Error('the holder transaction finished without holding the row')
      }),
    ])
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '2s'`)
        await tx.execute(sql`SELECT purge_expired_account_deletions()`)
      })
    } finally {
      release()
      await holder
    }

    const [skippedRequest] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, request.id))
    expect(skippedRequest?.completedAt).toBeNull()
    const remainingUser = await db.select().from(users).where(eq(users.id, userId))
    expect(remainingUser).toHaveLength(1)
  })

  it('is scheduled by pg_cron at a recurring interval', async () => {
    const rows = await db.execute<{ jobname: string; schedule: string; command: string }>(
      sql`SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'purge-expired-account-deletions'`,
    )
    expect(rows.length).toBe(1)
    expect(rows[0]!.command).toMatch(/purge_expired_account_deletions/)
  })
})

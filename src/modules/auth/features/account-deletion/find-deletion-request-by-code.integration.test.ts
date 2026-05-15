import { randomUUID } from 'node:crypto'

import { inArray } from 'drizzle-orm'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { accountDeletionRequests } from '@/shared/db/schema'
import { cleanupAuthUser, getAdminSupabase, uniqueTestEmail } from '@/shared/db/test-helpers'
import {
  AccountDeletionRequestIdSchema,
  UserIdSchema,
  type AccountDeletionRequestId,
  type UserId,
} from '@/shared/lib/ids'

import { findDeletionRequestByCode } from './find-deletion-request-by-code'

describe('findDeletionRequestByCode', () => {
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

  async function seedRequest(prefix: string) {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail(prefix),
      email_confirm: true,
      user_metadata: { name: `Lookup ${prefix}` },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    createdUserIds.push(data.user.id)
    const userId: UserId = UserIdSchema.parse(data.user.id)
    const code = randomUUID()
    const [row] = await db
      .insert(accountDeletionRequests)
      .values({
        userId,
        scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        source: 'user',
        confirmationCode: code,
      })
      .returning()
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(row!.id))
    return { row: row!, code }
  }

  it('returns the row for a valid confirmation code', async () => {
    const { row, code } = await seedRequest('valid')

    const found = await findDeletionRequestByCode(code)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(row.id)
    expect(found!.confirmationCode).toBe(code)
  })

  it('returns null for an unknown confirmation code', async () => {
    const found = await findDeletionRequestByCode(randomUUID())
    expect(found).toBeNull()
  })

  it('returns null for an empty or malformed code without throwing', async () => {
    expect(await findDeletionRequestByCode('')).toBeNull()
    expect(await findDeletionRequestByCode('   ')).toBeNull()
  })

  it('returns null for an over-length code without querying the database', async () => {
    const overlong = 'a'.repeat(1024)
    expect(await findDeletionRequestByCode(overlong)).toBeNull()
  })
})

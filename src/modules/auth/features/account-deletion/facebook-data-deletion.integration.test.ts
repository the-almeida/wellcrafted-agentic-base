import { createHmac, randomUUID } from 'node:crypto'

import { and, eq, inArray, sql } from 'drizzle-orm'
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

import { handleFacebookDataDeletion } from './facebook-data-deletion'

const APP_SECRET = 'test-app-secret-do-not-use-in-prod'
const STATUS_URL_BASE = 'https://example.test/data-deletion/status'

function createSignedRequest(payload: Record<string, unknown>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret).update(body).digest('base64url')
  return `${signature}.${body}`
}

describe('handleFacebookDataDeletion', () => {
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

  async function seedFacebookLinkedUser(prefix: string): Promise<{
    userId: UserId
    facebookId: string
  }> {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail(prefix),
      email_confirm: true,
      user_metadata: { name: `FB ${prefix}` },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    createdUserIds.push(data.user.id)
    const userId = UserIdSchema.parse(data.user.id)

    // Simulate the row Supabase Auth would create after a successful
    // Facebook OAuth sign-in. We don't run the full OAuth flow because
    // local Supabase can't talk to facebook.com.
    const facebookId = `fb-${randomUUID()}`
    const identityData = JSON.stringify({ sub: facebookId })
    await db.execute(
      sql`INSERT INTO auth.identities (provider, provider_id, user_id, identity_data) VALUES ('facebook', ${facebookId}, ${userId}::uuid, ${identityData}::jsonb)`,
    )
    return { userId, facebookId }
  }

  it('creates an active deletion request and returns a status URL on a valid signed_request', async () => {
    const { userId, facebookId } = await seedFacebookLinkedUser('happy')

    const signedRequest = createSignedRequest(
      { algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000), user_id: facebookId },
      APP_SECRET,
    )

    const result = await handleFacebookDataDeletion({
      signedRequest,
      appSecret: APP_SECRET,
      statusUrlBase: STATUS_URL_BASE,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw result.error
    expect(result.value.confirmationCode).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(result.value.url).toBe(`${STATUS_URL_BASE}?code=${result.value.confirmationCode}`)

    const [row] = await db
      .select()
      .from(accountDeletionRequests)
      .where(
        and(
          eq(accountDeletionRequests.userId, userId),
          eq(accountDeletionRequests.confirmationCode, result.value.confirmationCode),
        ),
      )
    expect(row).toBeDefined()
    expect(row!.source).toBe('facebook')
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(row!.id))
  })

  it('returns a valid response without writing a row when no matching identity exists', async () => {
    const signedRequest = createSignedRequest(
      { algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000), user_id: 'fb-unknown' },
      APP_SECRET,
    )

    const before = await db.select().from(accountDeletionRequests)
    const beforeCount = before.length

    const result = await handleFacebookDataDeletion({
      signedRequest,
      appSecret: APP_SECRET,
      statusUrlBase: STATUS_URL_BASE,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw result.error
    expect(result.value.confirmationCode).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(result.value.url).toBe(`${STATUS_URL_BASE}?code=${result.value.confirmationCode}`)

    const after = await db.select().from(accountDeletionRequests)
    expect(after.length).toBe(beforeCount)
  })

  it('returns the existing confirmation code when the user already has an active request', async () => {
    const { userId, facebookId } = await seedFacebookLinkedUser('existing')
    const signedRequest = createSignedRequest(
      { algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000), user_id: facebookId },
      APP_SECRET,
    )

    const first = await handleFacebookDataDeletion({
      signedRequest,
      appSecret: APP_SECRET,
      statusUrlBase: STATUS_URL_BASE,
    })
    if (!first.ok) throw first.error
    const [firstRow] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, userId))
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(firstRow!.id))

    const second = await handleFacebookDataDeletion({
      signedRequest,
      appSecret: APP_SECRET,
      statusUrlBase: STATUS_URL_BASE,
    })
    if (!second.ok) throw second.error

    expect(second.value.confirmationCode).toBe(first.value.confirmationCode)
    const rows = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, userId))
    expect(rows).toHaveLength(1)
  })

  it('rejects a signed_request with an invalid signature and writes nothing', async () => {
    const { userId, facebookId } = await seedFacebookLinkedUser('bad-sig')
    const signedRequest = createSignedRequest(
      { algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000), user_id: facebookId },
      'wrong-secret',
    )

    const result = await handleFacebookDataDeletion({
      signedRequest,
      appSecret: APP_SECRET,
      statusUrlBase: STATUS_URL_BASE,
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.error.code).toBe('VALIDATION_ERROR')

    const rows = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, userId))
    expect(rows).toHaveLength(0)
  })

  it('rejects a malformed signed_request body', async () => {
    const cases = ['', 'not-a-signed-request', 'sig.', '.payload', 'sig.!!!not-base64!!!']
    for (const signedRequest of cases) {
      const result = await handleFacebookDataDeletion({
        signedRequest,
        appSecret: APP_SECRET,
        statusUrlBase: STATUS_URL_BASE,
      })
      expect(result.ok, `expected rejection for "${signedRequest}"`).toBe(false)
      if (result.ok) throw new Error('expected error')
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('rejects a signed_request whose algorithm is not HMAC-SHA256', async () => {
    const signedRequest = createSignedRequest(
      { algorithm: 'PLAINTEXT', issued_at: Math.floor(Date.now() / 1000), user_id: 'whatever' },
      APP_SECRET,
    )
    const result = await handleFacebookDataDeletion({
      signedRequest,
      appSecret: APP_SECRET,
      statusUrlBase: STATUS_URL_BASE,
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects a stale signed_request (issued_at older than the freshness window)', async () => {
    const elevenMinutesAgo = Math.floor(Date.now() / 1000) - 11 * 60
    const signedRequest = createSignedRequest(
      { algorithm: 'HMAC-SHA256', issued_at: elevenMinutesAgo, user_id: 'fb-stale' },
      APP_SECRET,
    )
    const result = await handleFacebookDataDeletion({
      signedRequest,
      appSecret: APP_SECRET,
      statusUrlBase: STATUS_URL_BASE,
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects a signed_request whose expires timestamp is in the past', async () => {
    const signedRequest = createSignedRequest(
      {
        algorithm: 'HMAC-SHA256',
        issued_at: Math.floor(Date.now() / 1000),
        expires: Math.floor(Date.now() / 1000) - 60,
        user_id: 'fb-expired',
      },
      APP_SECRET,
    )
    const result = await handleFacebookDataDeletion({
      signedRequest,
      appSecret: APP_SECRET,
      statusUrlBase: STATUS_URL_BASE,
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an over-length signed_request without computing the HMAC', async () => {
    const overlong = 'a'.repeat(5000) + '.' + 'b'.repeat(5000)
    const result = await handleFacebookDataDeletion({
      signedRequest: overlong,
      appSecret: APP_SECRET,
      statusUrlBase: STATUS_URL_BASE,
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })
})

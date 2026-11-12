import { createHmac, randomUUID } from 'node:crypto'

import { eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/shared/db/client'
import { accountDeletionRequests } from '@/shared/db/schema'
import { cleanupAuthUser, getAdminSupabase, uniqueTestEmail } from '@/shared/db/test-helpers'
import { UserIdSchema, type UserId } from '@/shared/lib/ids'

// Port boundary: the test observes what is reported, not Sentry itself.
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

const ROUTE_URL = 'http://localhost/api/auth/facebook/data-deletion'

type FacebookEnv = { clientId?: string; secret?: string }

// The env module validates process.env once, at import, so each setup
// loads a fresh copy of the route with its own Facebook variables.
async function loadRoute({ clientId = '', secret = '' }: FacebookEnv) {
  vi.resetModules()
  vi.stubEnv('FACEBOOK_OAUTH_CLIENT_ID', clientId)
  vi.stubEnv('FACEBOOK_OAUTH_CLIENT_SECRET', secret)
  const { POST } = await import('./route')
  const { logger } = await import('@/shared/observability/logger')
  const Sentry = await import('@sentry/nextjs')
  vi.mocked(Sentry.captureException).mockClear()
  return { POST, logger, Sentry }
}

function spyOnLogs(logger: Awaited<ReturnType<typeof loadRoute>>['logger']) {
  return {
    error: vi.spyOn(logger, 'error').mockImplementation(() => undefined),
    warn: vi.spyOn(logger, 'warn').mockImplementation(() => undefined),
    info: vi.spyOn(logger, 'info').mockImplementation(() => undefined),
  }
}

// One IP per test, so rate-limit counters never leak between tests.
function callbackRequest(ip: string, body: Record<string, string> = {}): Request {
  return new Request(ROUTE_URL, {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: new URLSearchParams(body),
  })
}

const uniqueIp = () => `fb-test-${randomUUID()}`

const APP_SECRET = 'test-app-secret-do-not-use-in-prod'
const READY: FacebookEnv = { clientId: 'facebook-id', secret: APP_SECRET }

// Same format Facebook uses: base64url(HMAC-SHA256(payload)) + '.' + base64url(payload).
function signedRequestFor(facebookUserId: string, secret = APP_SECRET): string {
  const payload = Buffer.from(
    JSON.stringify({
      algorithm: 'HMAC-SHA256',
      issued_at: Math.floor(Date.now() / 1000),
      user_id: facebookUserId,
    }),
  ).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${signature}.${payload}`
}

let createdUserIds: UserId[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  for (const userId of createdUserIds) {
    await db.delete(accountDeletionRequests).where(eq(accountDeletionRequests.userId, userId))
    await cleanupAuthUser(userId)
  }
  createdUserIds = []
})

// A user who signed in with Facebook. Local Supabase cannot run the real
// OAuth flow, so the identity row is inserted the way Supabase Auth would.
async function seedFacebookUser(): Promise<{ userId: UserId; facebookId: string }> {
  const { data, error } = await getAdminSupabase().auth.admin.createUser({
    email: uniqueTestEmail('fb-route'),
    email_confirm: true,
    user_metadata: { name: 'FB route' },
  })
  if (error || !data.user) throw error ?? new Error('user not returned')
  const userId = UserIdSchema.parse(data.user.id)
  createdUserIds.push(userId)
  const facebookId = `fb-${randomUUID()}`
  const identityData = JSON.stringify({ sub: facebookId })
  await db.execute(
    sql`INSERT INTO auth.identities (provider, provider_id, user_id, identity_data) VALUES ('facebook', ${facebookId}, ${userId}::uuid, ${identityData}::jsonb)`,
  )
  return { userId, facebookId }
}

describe('POST /api/auth/facebook/data-deletion', () => {
  describe('when Facebook is not used (neither client id nor secret)', () => {
    it('answers 404 without logging, reporting or rate limiting', async () => {
      const { POST, logger, Sentry } = await loadRoute({})
      const logs = spyOnLogs(logger)
      const ip = uniqueIp()

      // One more call than the per-IP limit: a 404 must come before the limiter.
      // The body looks like a real Facebook call, so the 404 cannot depend on it.
      for (let call = 0; call < 31; call++) {
        const response = await POST(callbackRequest(ip, { signed_request: 'x.y' }))
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({ error: 'not_found' })
      }
      expect(logs.error).not.toHaveBeenCalled()
      expect(logs.warn).not.toHaveBeenCalled()
      expect(logs.info).not.toHaveBeenCalled()
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })
  })

  describe('when Facebook is active but the app secret is missing', () => {
    it('answers 503 and reports the misconfiguration to the logs and Sentry', async () => {
      const { POST, logger, Sentry } = await loadRoute({ clientId: 'facebook-client-id-value' })
      const logs = spyOnLogs(logger)

      const response = await POST(callbackRequest(uniqueIp(), { signed_request: 'x.y' }))

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'facebook_data_deletion_not_configured' })

      expect(logs.error).toHaveBeenCalledTimes(1)
      const [logged, logMessage] = logs.error.mock.calls[0] as unknown as [{ err: Error }, string]
      expect(logMessage).toContain('Facebook data deletion callback')
      expect(logged.err.message).toContain('FACEBOOK_OAUTH_CLIENT_SECRET is not')

      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
      expect(vi.mocked(Sentry.captureException).mock.calls[0]?.[0]).toBe(logged.err)
      // Names the variables, never their values.
      const allLogs = [logs.error, logs.warn, logs.info].map((spy) => spy.mock.calls)
      expect(JSON.stringify(allLogs)).not.toContain('facebook-client-id-value')
      expect(logged.err.message).not.toContain('facebook-client-id-value')
    })

    it('rate limits the 503, so anonymous callers cannot flood the logs and Sentry', async () => {
      const { POST, logger, Sentry } = await loadRoute({ clientId: 'facebook-id' })
      const logs = spyOnLogs(logger)
      const ip = uniqueIp()

      for (let call = 0; call < 30; call++) {
        expect((await POST(callbackRequest(ip))).status).toBe(503)
      }
      const blocked = await POST(callbackRequest(ip))

      expect(blocked.status).toBe(429)
      expect(logs.error).toHaveBeenCalledTimes(30)
      expect(Sentry.captureException).toHaveBeenCalledTimes(30)
    })
  })

  describe('when Facebook is fully configured', () => {
    it('rejects a call without signed_request with 400', async () => {
      const { POST } = await loadRoute(READY)

      const response = await POST(callbackRequest(uniqueIp()))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'missing_signed_request' })
    })

    it('rejects a signed_request signed with another secret, opening no deletion', async () => {
      const { POST } = await loadRoute(READY)
      const { userId, facebookId } = await seedFacebookUser()

      const response = await POST(
        callbackRequest(uniqueIp(), { signed_request: signedRequestFor(facebookId, 'wrong') }),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_signed_request' })
      const rows = await db
        .select()
        .from(accountDeletionRequests)
        .where(eq(accountDeletionRequests.userId, userId))
      expect(rows).toEqual([])
    })

    it('records a deletion request and answers with its status URL and code', async () => {
      const { POST } = await loadRoute(READY)
      const { userId, facebookId } = await seedFacebookUser()

      const response = await POST(
        callbackRequest(uniqueIp(), { signed_request: signedRequestFor(facebookId) }),
      )

      expect(response.status).toBe(200)
      const body = (await response.json()) as { url: string; confirmation_code: string }
      expect(body.url).toBe(
        `${process.env.NEXT_PUBLIC_APP_URL}/data-deletion/status?code=${body.confirmation_code}`,
      )
      const rows = await db
        .select()
        .from(accountDeletionRequests)
        .where(eq(accountDeletionRequests.userId, userId))
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        source: 'facebook',
        confirmationCode: body.confirmation_code,
      })
    })

    it('keeps recording deletions with only the secret, after Facebook sign-in is turned off', async () => {
      const { POST } = await loadRoute({ secret: APP_SECRET })
      const { userId, facebookId } = await seedFacebookUser()

      const response = await POST(
        callbackRequest(uniqueIp(), { signed_request: signedRequestFor(facebookId) }),
      )

      expect(response.status).toBe(200)
      const rows = await db
        .select()
        .from(accountDeletionRequests)
        .where(eq(accountDeletionRequests.userId, userId))
      expect(rows).toHaveLength(1)
    })

    it('rejects a declared body over 8KB with 413 before reading it', async () => {
      const { POST } = await loadRoute(READY)
      // The body itself is tiny, so only the declared length can produce a 413.
      const request = new Request(ROUTE_URL, {
        method: 'POST',
        headers: { 'x-forwarded-for': uniqueIp(), 'content-length': String(8 * 1024 + 1) },
        body: new URLSearchParams({ signed_request: 'x.y' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(413)
      expect(await response.json()).toEqual({ error: 'body_too_large' })
    })

    it('answers 429 on the 31st call from one IP within a minute', async () => {
      const { POST } = await loadRoute(READY)
      const ip = uniqueIp()

      for (let call = 0; call < 30; call++) {
        expect((await POST(callbackRequest(ip))).status).not.toBe(429)
      }
      const blocked = await POST(callbackRequest(ip))

      expect(blocked.status).toBe(429)
      expect(await blocked.json()).toEqual({ error: 'too_many_requests' })
    })
  })
})

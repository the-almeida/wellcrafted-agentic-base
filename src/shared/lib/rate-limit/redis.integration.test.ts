import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import * as Sentry from '@sentry/nextjs'
import { Redis } from '@upstash/redis'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { logger } from '@/shared/observability/logger'

import { describeRateLimitContract } from './contract.test-helper'
import { createRedisClient, createRedisRateLimiter } from './redis'

// Sentry is an external sink; the test only checks what reaches it.
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

// serverless-redis-http from docker-compose.yml: the Upstash REST API in
// front of a real Redis. Values are local-only and match the compose file.
const SRH_URL = 'http://127.0.0.1:8079'
const SRH_TOKEN = 'local-srh-token'

const redis = new Redis({ url: SRH_URL, token: SRH_TOKEN })

beforeAll(async () => {
  try {
    await redis.ping()
  } catch (cause) {
    throw new Error(
      `Redis for the rate-limit tests is not reachable at ${SRH_URL}. Run \`docker compose up -d\`.`,
      { cause },
    )
  }
})

describeRateLimitContract('redis', () => createRedisRateLimiter(redis))

describe('redis rate limit: expiry', () => {
  // The limiter stores each counter under `rl:<key>`. Tests that inspect or
  // plant counters need that name; nothing else depends on it.
  const storedKey = (key: string) => `rl:${key}`
  const planted: string[] = []

  afterEach(async () => {
    if (planted.length > 0) await redis.del(...planted.splice(0))
  })

  it('gives every counter an expiry from the first call', async () => {
    const limit = createRedisRateLimiter(redis)
    const key = `expiry:fresh:${randomUUID()}`
    planted.push(storedKey(key))

    await limit(key, { windowMs: 5_000, max: 3 })

    const ttl = await redis.pttl(storedKey(key))
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(5_000)
  })

  it('heals a counter left without expiry, so it stops blocking forever', async () => {
    const limit = createRedisRateLimiter(redis)
    const key = `expiry:stuck:${randomUUID()}`
    const config = { windowMs: 400, max: 1 }
    // What a crash between INCR and PEXPIRE used to leave behind: a counter
    // already over the limit that never expires.
    planted.push(storedKey(key))
    await redis.set(storedKey(key), 7)
    expect(await redis.pttl(storedKey(key))).toBe(-1)

    expect((await limit(key, config)).ok).toBe(false)
    // @wc-test-auditor-allow: sleep-band-aid — Redis TTLs run on the server clock; fake timers cannot advance them
    await sleep(config.windowMs + 150)

    expect((await limit(key, config)).ok).toBe(true)
  })
})

describe('redis rate limit: concurrency', () => {
  it('lets exactly max calls through when many arrive at once', async () => {
    const limit = createRedisRateLimiter(redis)
    const key = `concurrency:${randomUUID()}`
    const config = { windowMs: 60_000, max: 5 }

    const results = await Promise.all(Array.from({ length: 20 }, () => limit(key, config)))

    expect(results.filter((r) => r.ok)).toHaveLength(5)
    expect(results.filter((r) => !r.ok)).toHaveLength(15)
  })
})

describe('redis rate limit: backend failure', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(Sentry.captureException).mockClear()
  })

  async function expectFailsOpen(client: Redis) {
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const limit = createRedisRateLimiter(client)
    const key = `failure:${randomUUID()}`

    const startedAt = Date.now()
    const result = await limit(key, { windowMs: 60_000, max: 1 })
    const elapsedMs = Date.now() - startedAt

    expect(result).toEqual({ ok: true, value: undefined })
    expect(logged).toHaveBeenCalledTimes(1)
    const [fields, message] = logged.mock.calls[0] as [Record<string, unknown>, string]
    expect(message).toBe('rate limit backend unavailable; failing open')
    const reported = fields.err as Error
    expect(reported).toBeInstanceOf(Error)
    // The key can embed an email; it must reach neither the logs nor Sentry.
    expect(reported.message).not.toContain(key)
    expect(String(reported.stack)).not.toContain(key)
    // Pino and Sentry both print `cause`; the original error must not ride along.
    expect(reported.cause).toBeUndefined()
    expect(JSON.stringify(fields)).not.toContain(key)
    expect(Sentry.captureException).toHaveBeenCalledWith(reported)
    return elapsedMs
  }

  it('lets the call through and reports it when Redis is unreachable', async () => {
    // Nothing listens on this port: the connection is refused immediately.
    const elapsedMs = await expectFailsOpen(
      createRedisClient({ url: 'http://127.0.0.1:59999', token: SRH_TOKEN }),
    )

    // Production client settings keep an outage from stalling every call.
    expect(elapsedMs).toBeLessThan(2_000)
  })

  it('lets the call through and reports it when Redis accepts but never answers', async () => {
    // A server that accepts connections and stays silent, like a hung network path.
    const silent = createServer(() => undefined)
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve))
    const { port } = silent.address() as AddressInfo
    try {
      const elapsedMs = await expectFailsOpen(
        createRedisClient({ url: `http://127.0.0.1:${port}`, token: SRH_TOKEN }),
      )

      // Two attempts of at most one second each, plus the backoff.
      expect(elapsedMs).toBeLessThan(3_000)
    } finally {
      silent.closeAllConnections?.()
      await new Promise((resolve) => silent.close(resolve))
    }
  })

  it('lets the call through and reports it when the token is rejected', async () => {
    await expectFailsOpen(createRedisClient({ url: SRH_URL, token: 'wrong-token' }))
  })
})

describe('rateLimit (public entry point)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('counts in Redis when both KV variables are set', async () => {
    vi.resetModules()
    vi.stubEnv('KV_REST_API_URL', SRH_URL)
    vi.stubEnv('KV_REST_API_TOKEN', SRH_TOKEN)
    const { logger: freshLogger } = await import('@/shared/observability/logger')
    const warned = vi.spyOn(freshLogger, 'warn').mockImplementation(() => undefined)
    const { rateLimit } = await import('./index')
    const key = `entry:${randomUUID()}`

    expect((await rateLimit(key, { windowMs: 60_000, max: 5 })).ok).toBe(true)

    const ttl = await redis.pttl(`rl:${key}`)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(60_000)
    expect(warned).not.toHaveBeenCalled()
  })
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

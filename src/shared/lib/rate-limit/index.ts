import { Redis } from '@upstash/redis'

import { err, ok, type Result } from '@/shared/lib/result'

export type RateLimitKey = string

export type RateLimitConfig = {
  windowMs: number
  max: number
}

export class RateLimitExceededError extends Error {
  readonly code = 'RATE_LIMIT_EXCEEDED' as const
  constructor(
    public readonly key: RateLimitKey,
    message = 'Rate limit exceeded',
  ) {
    super(message)
    this.name = 'RateLimitExceededError'
  }
}

/**
 * Rate limiter with two backends:
 *
 * - **Vercel Marketplace Redis** (branded "Vercel KV") when
 *   `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set. Production-safe
 *   across serverless functions and multi-region deploys. Uses Upstash's
 *   client because Vercel deprecated `@vercel/kv`; the storage is still
 *   the Vercel-provisioned Redis store.
 * - **In-memory `Map`** fallback when those vars are absent. Fine for
 *   local dev (single-process); resets on restart and DOES NOT share
 *   state across replicas — never deploy this to multi-instance prod.
 *   A one-time warning logs at module load to surface that.
 *
 * The fixed-window algorithm is intentionally simple: `INCR`, set TTL
 * on the first increment, compare against `max`. Sliding-window is
 * marginally more accurate but the extra accuracy doesn't justify the
 * extra code for the boilerplate's threat model.
 */

type Counter = { count: number; resetAt: number }
const memoryStore = new Map<RateLimitKey, Counter>()

const KV_URL = process.env.KV_REST_API_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN
const useRedis = Boolean(KV_URL && KV_TOKEN)

// Construct the client lazily so import-time side effects stay quiet
// when the env vars are absent. We use `globalThis` to avoid creating
// a fresh client per request in dev-mode HMR.
const globalForRedis = globalThis as unknown as { __rateLimitRedis?: Redis }
function getRedis(): Redis {
  if (!globalForRedis.__rateLimitRedis) {
    globalForRedis.__rateLimitRedis = new Redis({ url: KV_URL, token: KV_TOKEN })
  }
  return globalForRedis.__rateLimitRedis
}

if (!useRedis && typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // One-time stderr nudge so the developer notices the boilerplate is
  // running without a real backing store. Pino isn't used here to avoid
  // pulling the logger into the rate-limit module's import graph.
  console.warn(
    '[rate-limit] KV_REST_API_URL / KV_REST_API_TOKEN unset — using in-memory backend. NOT safe for multi-instance production.',
  )
}

export async function rateLimit(
  key: RateLimitKey,
  config: RateLimitConfig,
): Promise<Result<void, RateLimitExceededError>> {
  if (useRedis) return rateLimitRedis(key, config)
  return rateLimitMemory(key, config)
}

function rateLimitMemory(
  key: RateLimitKey,
  config: RateLimitConfig,
): Result<void, RateLimitExceededError> {
  const now = Date.now()
  const existing = memoryStore.get(key)
  if (!existing || existing.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs })
    return ok(undefined)
  }
  if (existing.count >= config.max) {
    return err(new RateLimitExceededError(key))
  }
  existing.count += 1
  return ok(undefined)
}

async function rateLimitRedis(
  key: RateLimitKey,
  config: RateLimitConfig,
): Promise<Result<void, RateLimitExceededError>> {
  const redis = getRedis()
  const namespaced = `rl:${key}`
  const count = await redis.incr(namespaced)
  if (count === 1) {
    // First hit of the window — set the TTL so the key auto-evicts.
    await redis.pexpire(namespaced, config.windowMs)
  }
  if (count > config.max) {
    return err(new RateLimitExceededError(key))
  }
  return ok(undefined)
}

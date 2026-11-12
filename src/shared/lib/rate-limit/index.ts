import { Redis } from '@upstash/redis'

import { env } from '@/shared/lib/env'
import { AppError } from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'

export type RateLimitKey = string

export type RateLimitConfig = {
  windowMs: number
  max: number
}

export class RateLimitExceededError extends AppError {
  readonly code = 'RATE_LIMIT_EXCEEDED' as const
  constructor(
    public readonly key: RateLimitKey,
    message = 'Rate limit exceeded',
  ) {
    super(message)
  }
}

/**
 * Backends and when each is used: docs/conventions.md#rate-limiting.
 *
 * Fixed window on purpose: sliding-window is marginally more accurate
 * but the extra accuracy doesn't justify the extra code for the
 * boilerplate's threat model.
 */

type Counter = { count: number; resetAt: number }
const memoryStore = new Map<RateLimitKey, Counter>()

const KV_URL = env.KV_REST_API_URL
const KV_TOKEN = env.KV_REST_API_TOKEN
const useRedis = Boolean(KV_URL && KV_TOKEN)

// We use `globalThis` to avoid creating a fresh client per request in
// dev-mode HMR.
const globalForRedis = globalThis as unknown as { __rateLimitRedis?: Redis }
function getRedis(): Redis {
  if (!globalForRedis.__rateLimitRedis) {
    globalForRedis.__rateLimitRedis = new Redis({ url: KV_URL, token: KV_TOKEN })
  }
  return globalForRedis.__rateLimitRedis
}

let hasWarnedAboutMemoryBackend = false
function warnOnceAboutMemoryBackend() {
  if (hasWarnedAboutMemoryBackend || process.env.NODE_ENV === 'test') return
  hasWarnedAboutMemoryBackend = true
  // Pino isn't used here to avoid pulling the logger into the rate-limit
  // module's import graph.
  console.warn(
    '[rate-limit] KV_REST_API_URL / KV_REST_API_TOKEN unset — using in-memory backend. Dev only; see docs/conventions.md#rate-limiting.',
  )
}

export async function rateLimit(
  key: RateLimitKey,
  config: RateLimitConfig,
): Promise<Result<void, RateLimitExceededError>> {
  if (useRedis) return rateLimitRedis(key, config)
  warnOnceAboutMemoryBackend()
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
  // One MULTI round trip, so a dropped connection cannot leave a counter
  // without an expiry (which would block the key forever). `NX` only sets
  // the expiry when the key has none, so the window does not slide.
  const [count] = await redis
    .multi()
    .incr(namespaced)
    .pexpire(namespaced, config.windowMs, 'NX')
    .exec<[number, 0 | 1]>()
  if (count > config.max) {
    return err(new RateLimitExceededError(key))
  }
  return ok(undefined)
}

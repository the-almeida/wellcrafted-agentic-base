import { env } from '@/shared/lib/env'
import { logger } from '@/shared/observability/logger'

import type { RateLimitConfig, RateLimiter, RateLimitKey } from './limiter'
import { createMemoryRateLimiter } from './memory'
import { createRedisClient, createRedisRateLimiter } from './redis'

export { rateLimitKey, type RateLimitSubject } from './key'
export {
  RateLimitExceededError,
  type RateLimitConfig,
  type RateLimiter,
  type RateLimitKey,
} from './limiter'

/**
 * Rate limiting for public endpoints, backed by Redis when
 * `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set (the `env` module
 * rejects one without the other), otherwise in memory. In-memory counters
 * reset on restart and are not shared across instances: fine for local dev
 * and single-instance deploys, never for multi-instance production.
 *
 * The limiter is built on first use, so importing this module has no side
 * effects.
 */

let limiter: RateLimiter | undefined

function getLimiter(): RateLimiter {
  if (limiter) return limiter
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    limiter = createRedisRateLimiter(
      createRedisClient({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN }),
    )
  } else {
    logger.warn(
      '[rate-limit] in-memory rate limiting active; not safe for multi-instance production',
    )
    limiter = createMemoryRateLimiter()
  }
  return limiter
}

export function rateLimit(key: RateLimitKey, config: RateLimitConfig) {
  return getLimiter()(key, config)
}

import * as Sentry from '@sentry/nextjs'
import { Redis } from '@upstash/redis'

import { err, ok } from '@/shared/lib/result'
import { logger } from '@/shared/observability/logger'

import { RateLimitExceededError, type RateLimiter } from './limiter'

// Runs atomically inside Redis: increment, then give the counter an expiry
// if it has none. Doing INCR and PEXPIRE as two calls could leave a counter
// with no expiry (a crash or network error in between), which then blocks
// that key forever. Checking PTTL instead of "count == 1" also heals any
// counter already stuck that way.
const INCREMENT_WITH_EXPIRY = `
local count = redis.call('INCR', KEYS[1])
if redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`

const REQUEST_TIMEOUT_MS = 1_000

/**
 * The client defaults (5 retries, exponential backoff) would add seconds to
 * every rate-limited call while Redis is down. Since the limiter fails open,
 * a short timeout and a single retry bound that cost.
 */
export function createRedisClient(credentials: { url: string; token: string }): Redis {
  return new Redis({
    ...credentials,
    retry: { retries: 1, backoff: () => 50 },
    signal: () => AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

/**
 * A rate limit is defense against abuse, not authorization: when Redis is
 * unavailable the call proceeds, and the failure is reported to the logs and
 * Sentry so the outage is noticed.
 */
export function createRedisRateLimiter(redis: Redis): RateLimiter {
  return async (key, config) => {
    let count: number
    try {
      count = await redis.eval<[number], number>(
        INCREMENT_WITH_EXPIRY,
        [`rl:${key}`],
        [config.windowMs],
      )
    } catch (error) {
      reportBackendFailure(error)
      return ok(undefined)
    }
    if (count > config.max) {
      return err(new RateLimitExceededError(key))
    }
    return ok(undefined)
  }
}

function reportBackendFailure(error: unknown): void {
  // Upstash errors append the whole command to the message, and the command
  // carries the key, which can embed an email. Report only the part before it.
  const detail = error instanceof Error ? error.message.split(', command was:')[0] : String(error)
  const reported = new Error(`rate limit backend request failed: ${detail}`)
  logger.error({ err: reported }, 'rate limit backend unavailable; failing open')
  Sentry.captureException(reported)
}

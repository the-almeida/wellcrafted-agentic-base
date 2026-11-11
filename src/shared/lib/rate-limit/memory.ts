import { err, ok } from '@/shared/lib/result'

import { RateLimitExceededError, type RateLimiter, type RateLimitKey } from './limiter'

type Counter = { count: number; resetAt: number }

/**
 * Counters live in this process only: they reset on restart and are not
 * shared across instances. Fine for local dev and single-instance deploys.
 */
export function createMemoryRateLimiter(): RateLimiter {
  const store = new Map<RateLimitKey, Counter>()

  return async (key, config) => {
    const now = Date.now()
    const existing = store.get(key)
    if (!existing || existing.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + config.windowMs })
      return ok(undefined)
    }
    if (existing.count >= config.max) {
      return err(new RateLimitExceededError(key))
    }
    existing.count += 1
    return ok(undefined)
  }
}

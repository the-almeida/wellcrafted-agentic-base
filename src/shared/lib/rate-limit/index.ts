import { ok, type Result } from '@/shared/lib/result'

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
 * Skeleton — currently a no-op that returns ok(undefined) for every call.
 * Picks up real behavior once a backing store is chosen (see ./README.md).
 * Callers should already wire this in front of public endpoints; the DoD
 * tracks them and the implementation slot-in is non-breaking.
 */
export async function rateLimit(
  _key: RateLimitKey,
  _config: RateLimitConfig,
): Promise<Result<void, RateLimitExceededError>> {
  return ok(undefined)
}

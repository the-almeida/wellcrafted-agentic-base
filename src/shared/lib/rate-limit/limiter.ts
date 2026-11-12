import { AppError } from '@/shared/lib/errors/base'
import type { Result } from '@/shared/lib/result'

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
    options?: { cause?: unknown },
  ) {
    super(message, options)
  }
}

/**
 * Fixed-window limiter: the first call on a key opens a window of
 * `windowMs`; up to `max` calls pass inside it, later ones are rejected
 * until the window closes.
 */
export type RateLimiter = (
  key: RateLimitKey,
  config: RateLimitConfig,
) => Promise<Result<void, RateLimitExceededError>>

import * as Sentry from '@sentry/nextjs'

import type { Result } from '@/shared/lib/result'
import { logger } from '@/shared/observability/logger'

import { type ActionResult, toActionError } from './action-error'
import { AppError } from './base'

/**
 * The seam every server action goes through. It does two things:
 *
 * 1. **Unexpected throws** reach Sentry and the structured logger, then
 *    re-throw so Next's error boundary still renders. Required because
 *    Sentry's Next.js SDK does NOT auto-instrument server actions (there
 *    is no global error hook for them in Next).
 * 2. **Expected errors** (`err(new SomeAppError(...))`) are converted to
 *    plain `ActionError` objects. React Flight drops Error instances to a
 *    generic message in production, so returning them as-is means the
 *    client never sees `code` or the real message. See `action-error.ts`.
 *
 * Route Handlers and Server Components are auto-captured via the
 * `onRequestError` hook in `instrumentation.ts`, so they do NOT need this
 * wrapper. They also don't cross Flight with a Result, so they keep the
 * error instances.
 */
export function withErrorBoundary<
  TArgs extends unknown[],
  TReturn extends Result<unknown, AppError>,
>(fn: (...args: TArgs) => Promise<TReturn>): (...args: TArgs) => Promise<ActionResult<TReturn>> {
  return async (...args) => {
    let result: TReturn
    try {
      result = await fn(...args)
    } catch (err) {
      logger.error({ err }, 'unhandled exception in server action')
      Sentry.captureException(err)
      throw err
    }
    if (!result.ok && result.error instanceof AppError) {
      return { ok: false, error: toActionError(result.error) } as ActionResult<TReturn>
    }
    return result as ActionResult<TReturn>
  }
}

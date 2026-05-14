import * as Sentry from '@sentry/nextjs'

import { logger } from '@/shared/observability/logger'

/**
 * Wraps server actions so thrown exceptions reach Sentry and the structured
 * logger. Required because Sentry's Next.js SDK does NOT auto-instrument
 * server actions (there is no global error hook for them in Next).
 *
 * Route Handlers and Server Components are auto-captured via the
 * `onRequestError` hook in `instrumentation.ts`, so they do NOT need this
 * wrapper.
 *
 * Re-throws after capture so Next's error boundary still renders.
 */
export function withErrorBoundary<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (err) {
      logger.error({ err }, 'unhandled exception in server action')
      Sentry.captureException(err)
      throw err
    }
  }
}

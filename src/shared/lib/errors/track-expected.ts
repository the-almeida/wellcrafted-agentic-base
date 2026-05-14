import { Events } from '@/shared/observability/analytics/events'
import { track } from '@/shared/observability/analytics/track'

import type { AppError } from './base'

const ERROR_CODE_TO_KIND = {
  VALIDATION_ERROR: 'validation',
  NOT_FOUND: 'not_found',
  FORBIDDEN: 'forbidden',
  UNAUTHENTICATED: 'unauthenticated',
  CONFLICT: 'conflict',
  EXTERNAL_SERVICE_ERROR: 'external_service',
} as const

/**
 * Emit a PostHog event when an expected error needs visibility on its rate.
 *
 * Call this at handler boundaries where the error rate carries product or
 * operational signal (auth flows, payment, anything user-facing). Do NOT
 * auto-call for every Result error: most expected errors are user behavior,
 * not signal, and tracking them all is noisy and expensive.
 *
 * Add it sparingly. Remove when the dashboard stops being useful.
 */
export function trackExpectedError(error: AppError, feature: string): void {
  const kind = ERROR_CODE_TO_KIND[error.code as keyof typeof ERROR_CODE_TO_KIND]
  if (!kind) return
  track(Events.EXPECTED_ERROR, { kind, feature })
}

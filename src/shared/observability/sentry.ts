import * as Sentry from '@sentry/nextjs'

import type { UserId } from '@/shared/lib/ids'

export function setSentryUser(userId: UserId | null): void {
  Sentry.setUser(userId ? { id: userId } : null)
}

export function captureException(error: unknown): void {
  Sentry.captureException(error)
}

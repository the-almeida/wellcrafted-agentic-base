'use client'

import * as Sentry from '@sentry/nextjs'

import type { UserId } from '@/shared/lib/ids'

export function setSentryUserClient(userId: UserId | null): void {
  Sentry.setUser(userId ? { id: userId } : null)
}

export function captureExceptionClient(error: unknown): void {
  Sentry.captureException(error)
}

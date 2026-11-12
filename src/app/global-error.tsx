'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

import { Events } from '@/shared/observability/analytics/events'
import { track } from '@/shared/observability/analytics/track.client'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
    track(Events.CRITICAL_ERROR_SHOWN, {
      page: window.location.pathname,
      // `digest` only exists for errors thrown on the server.
      code: error.digest ?? 'client',
    })
  }, [error])

  return (
    <html lang="en">
      <body>
        <h1>Something went wrong</h1>
        <p>We have been notified. Please try again.</p>
      </body>
    </html>
  )
}

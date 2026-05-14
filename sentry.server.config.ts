import * as Sentry from '@sentry/nextjs'

import { env } from '@/shared/lib/env'
import { getRequestContext } from '@/shared/observability/request-context'

if (env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    // Sample 10% of requests for distributed performance tracing. Error
    // events are captured at 100% regardless; this only controls latency
    // spans, which are expensive to ingest.
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
    beforeSend(event) {
      const ctx = getRequestContext()
      if (ctx) {
        event.tags = { ...event.tags, requestId: ctx.requestId }
      }
      return event
    },
  })
}

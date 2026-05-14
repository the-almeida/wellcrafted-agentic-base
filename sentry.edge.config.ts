import * as Sentry from '@sentry/nextjs'

import { env } from '@/shared/lib/env'

// Edge runtime is banned project-wide (scripts/check-no-edge.sh). This file
// exists as a defensive fallback for Sentry's instrumentation register hook
// in case a future opt-in route ever lands on Edge. See docs/architecture.md.
if (env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
  })
}

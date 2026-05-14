import * as Sentry from '@sentry/nextjs'

import { env } from '@/shared/lib/env'

if (env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    // No performance monitoring on the client; bundle cost outweighs value
    // at this stage.
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
  })
}

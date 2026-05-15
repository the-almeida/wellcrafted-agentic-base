import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  // No edge branch: Edge runtime is banned project-wide
  // (scripts/check-no-edge.sh). See docs/architecture.md → Runtime model.
}

export const onRequestError = Sentry.captureRequestError

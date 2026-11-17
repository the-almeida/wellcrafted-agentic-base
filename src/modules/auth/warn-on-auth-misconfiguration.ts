import { env } from '@/shared/lib/env'
import { logger } from '@/shared/observability/logger'

import { facebookDataDeletionSetup } from './domain/oauth-providers'

/**
 * Called once at server startup (`instrumentation.ts`). Surfaces auth
 * settings that boot fine but break a flow later, so they show up in the
 * deploy logs instead of on the first real request.
 */
export function warnOnAuthMisconfiguration(): void {
  const facebook = facebookDataDeletionSetup(env)
  if (facebook.status === 'missing-secret') logger.warn(facebook.problem)
}

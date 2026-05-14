'use server'

import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { Events } from '@/shared/observability/analytics/events'
import { track } from '@/shared/observability/analytics/track'

import { authProvider } from '../../adapters/auth-provider.supabase'

export const signOut = withErrorBoundary(async () => {
  const result = await authProvider.signOut()
  if (!result.ok) return result
  track(Events.USER_SIGNED_OUT, {})
  return result
})

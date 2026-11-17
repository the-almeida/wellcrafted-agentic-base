import { ExternalServiceError } from '@/shared/lib/errors/base'
import { UserIdSchema } from '@/shared/lib/ids'
import { err, ok, type Result } from '@/shared/lib/result'
import { logger } from '@/shared/observability/logger'

import { AUTH_ERROR_MESSAGES, type AuthIdentity } from '../ports/auth-provider'

// Every account has a uuid id, and every permanent one an email; only
// anonymous accounts have none. Anything else is unexpected: logged, and
// answered like any other provider failure.
export function identityFromSupabaseUser(supaUser: {
  id: string
  email?: string | null
  is_anonymous?: boolean
}): Result<AuthIdentity, ExternalServiceError> {
  const idParsed = UserIdSchema.safeParse(supaUser.id)
  const isAnonymous = supaUser.is_anonymous === true
  if (!idParsed.success || (!supaUser.email && !isAnonymous)) {
    logger.error(
      { source: 'supabase', hasEmail: Boolean(supaUser.email), validId: idParsed.success },
      'Supabase returned a user the app cannot use',
    )
    return err(new ExternalServiceError('supabase', AUTH_ERROR_MESSAGES.unavailable))
  }
  return ok({ userId: idParsed.data, email: supaUser.email || null, isAnonymous })
}

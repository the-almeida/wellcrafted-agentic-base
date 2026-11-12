import { ExternalServiceError } from '@/shared/lib/errors/base'
import { UserIdSchema } from '@/shared/lib/ids'
import { err, ok, type Result } from '@/shared/lib/result'
import { logger } from '@/shared/observability/logger'

import { AUTH_ERROR_MESSAGES, type AuthIdentity } from '../ports/auth-provider'

// Every account this app creates has an email and a uuid id. A Supabase
// user without them is unexpected (anonymous users will be, in anonymous
// mode): logged, and answered like any other provider failure.
export function identityFromSupabaseUser(supaUser: {
  id: string
  email?: string | null
}): Result<AuthIdentity, ExternalServiceError> {
  const idParsed = UserIdSchema.safeParse(supaUser.id)
  if (!supaUser.email || !idParsed.success) {
    logger.error(
      { source: 'supabase', hasEmail: Boolean(supaUser.email), validId: idParsed.success },
      'Supabase returned a user the app cannot use',
    )
    return err(new ExternalServiceError('supabase', AUTH_ERROR_MESSAGES.unavailable))
  }
  return ok({ userId: idParsed.data, email: supaUser.email })
}

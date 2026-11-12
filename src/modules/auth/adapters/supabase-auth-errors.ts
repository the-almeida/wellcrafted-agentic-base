import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'

import { ExternalServiceError, UnauthenticatedError } from '@/shared/lib/errors/base'
import { RateLimitExceededError } from '@/shared/lib/rate-limit'
import { logger } from '@/shared/observability/logger'

import { AUTH_ERROR_MESSAGES, type AuthError } from '../ports/auth-provider'

export type SupabaseAuthOperation =
  | 'sign-in'
  | 'sign-up'
  | 'otp-request'
  | 'verify'
  | 'oauth'
  | 'sign-out'

// The failures each operation expects in normal traffic, by Supabase error
// code (auth-js `AuthApiError.code`). Matching on codes, never on message
// text, which Supabase may reword.
type Cause = { cause: unknown }
const EXPECTED: Record<SupabaseAuthOperation, Record<string, (cause: Cause) => AuthError>> = {
  'sign-in': {
    invalid_credentials: (cause) =>
      new UnauthenticatedError(AUTH_ERROR_MESSAGES.invalidCredentials, cause),
  },
  verify: {
    otp_expired: (cause) => new UnauthenticatedError(AUTH_ERROR_MESSAGES.invalidCode, cause),
  },
  'sign-up': {
    user_already_exists: (cause) =>
      new ExternalServiceError('supabase', AUTH_ERROR_MESSAGES.signUpFailed, cause),
  },
  'otp-request': {},
  oauth: {},
  'sign-out': {},
}

/**
 * Turns a Supabase Auth error into an error whose message is safe to show
 * the user (`AUTH_ERROR_MESSAGES`). The Supabase error stays in `cause`,
 * which is never serialized to the browser. Operational failures (Supabase
 * rate limits, outages, codes we do not expect) are logged with code and
 * status only: the email is never logged.
 */
export function mapSupabaseAuthError(op: SupabaseAuthOperation, error: unknown): AuthError {
  const status = statusOf(error)
  const code = isAuthApiError(error) ? error.code : undefined
  const context = { source: 'supabase', op, code, status }

  if (status === 429 || code === 'over_request_rate_limit') {
    // Our own limiter answers before Supabase does, so this usually means the
    // whole app's server IP is being throttled by Supabase.
    logger.warn(context, 'Supabase Auth rate limit reached')
    return new RateLimitExceededError('supabase-auth', AUTH_ERROR_MESSAGES.tooManyAttempts, {
      cause: error,
    })
  }

  const expected = code ? EXPECTED[op][code] : undefined
  if (expected && status !== undefined && status < 500) return expected({ cause: error })

  logger.error(context, 'Supabase Auth call failed')
  return new ExternalServiceError('supabase', AUTH_ERROR_MESSAGES.unavailable, { cause: error })
}

function statusOf(error: unknown): number | undefined {
  if (isAuthApiError(error) || isAuthRetryableFetchError(error)) return error.status
  return undefined
}

/**
 * Whether a failed code request should still answer "we sent a code". Both
 * cases would otherwise tell anyone whether an email has an account:
 *
 *   - `otp_disabled` on a sign-in request: the email has no account (the
 *     adapter never creates one from the sign-in page). Nothing is sent.
 *   - `over_email_send_rate_limit`: a code went to this address moments
 *     ago, which only happens for real accounts. "We sent a code" is true.
 *     Logged, because it also fires when the project's hourly email cap
 *     is used up, and then real users get no email.
 */
export function answersAsCodeSent(flow: 'sign-in' | 'sign-up', error: unknown): boolean {
  const code = isAuthApiError(error) ? error.code : undefined
  if (code === 'over_email_send_rate_limit') {
    logger.warn(
      { source: 'supabase', flow, code, status: statusOf(error) },
      'Supabase Auth email send limit reached; answered as sent',
    )
    return true
  }
  return flow === 'sign-in' && code === 'otp_disabled'
}

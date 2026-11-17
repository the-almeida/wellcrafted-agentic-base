import type { PublicAuthContext } from '../public-auth-context'
import { limitPublicAuthCall } from '../public-auth-rate-limits'

import type { RequestSignInOtpInput } from './request-sign-in-otp.schema'

/**
 * Sends a 6-digit code to an existing user. It never creates an account,
 * and an unknown email gets the same answer as a known one (no code is
 * sent), so the sign-in page cannot be used to find out who has an account.
 */
export async function requestSignInOtpWith(
  { authProvider, ip }: PublicAuthContext,
  input: RequestSignInOtpInput,
) {
  const limited = await limitPublicAuthCall(
    'otp-sign-in',
    { ip, email: input.email },
    { perIp: 30, perEmail: 5 },
  )
  if (!limited.ok) return limited

  return authProvider.requestSignInOtp({ email: input.email })
}

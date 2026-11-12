import type { PublicAuthContext } from '../public-auth-context'
import { limitPublicAuthCall } from '../public-auth-rate-limits'

import type { RequestSignInOtpInput } from './request-sign-in-otp.schema'

/**
 * Sends a 6-digit code to an existing user. The provider never creates an
 * account here (`shouldCreateUser: false` in the Supabase adapter): an
 * unknown email is an error, so a sign-in page cannot create accounts.
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

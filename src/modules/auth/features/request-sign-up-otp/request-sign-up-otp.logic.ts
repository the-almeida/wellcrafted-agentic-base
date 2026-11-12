import type { PublicAuthContext } from '../public-auth-context'
import { limitPublicAuthCall } from '../public-auth-rate-limits'

import type { RequestSignUpOtpInput } from './request-sign-up-otp.schema'

/**
 * Sends a 6-digit code, creating the account on the first request. `name`
 * rides in the user metadata, which the public.users sync trigger reads. If
 * the email already has an account, Supabase still sends a code and the
 * existing name is kept (the trigger uses ON CONFLICT DO NOTHING).
 */
export async function requestSignUpOtpWith(
  { authProvider, ip }: PublicAuthContext,
  input: RequestSignUpOtpInput,
) {
  const limited = await limitPublicAuthCall(
    'otp-sign-up',
    { ip, email: input.email },
    { perIp: 30, perEmail: 5 },
  )
  if (!limited.ok) return limited

  return authProvider.requestSignUpOtp({ email: input.email, name: input.name })
}

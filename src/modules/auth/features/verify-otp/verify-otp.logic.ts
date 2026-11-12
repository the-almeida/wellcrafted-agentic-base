import type { PublicAuthContext } from '../public-auth-context'
import { limitPublicAuthCall } from '../public-auth-rate-limits'

import type { VerifyOtpInput } from './verify-otp.schema'

/**
 * Verifies a 6-digit code and signs the browser in. Used by both the
 * sign-in and sign-up flows (Supabase does not tell them apart); the form
 * fires the matching analytics event because it knows its page. The
 * per-email limit slows code guessing on top of Supabase's own limits.
 */
export async function verifyOtpWith(
  { authProvider, ip }: PublicAuthContext,
  input: VerifyOtpInput,
) {
  const limited = await limitPublicAuthCall(
    'otp-verify',
    { ip, email: input.email },
    { perIp: 50, perEmail: 10 },
  )
  if (!limited.ok) return limited

  return authProvider.verifyOtp({ email: input.email, token: input.token })
}

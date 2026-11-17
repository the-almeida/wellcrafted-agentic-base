import { ok } from '@/shared/lib/result'

import { secureFirstEmailProof } from '../email-proof'
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

  const result = await authProvider.verifyOtp({ email: input.email, token: input.token })
  if (!result.ok) return result

  // Entering the emailed code proves the email, including for an account
  // that was created with a password.
  const proof = await secureFirstEmailProof(authProvider, result.value.userId, input.email)
  if (!proof.ok) return proof
  return ok({ ...result.value, ...proof.value })
}

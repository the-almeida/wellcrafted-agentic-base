import { rateLimit, rateLimitKey } from '@/shared/lib/rate-limit'

import type { PublicAuthContext } from '../public-auth-context'

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
  const emailLimit = await rateLimit(rateLimitKey('otp-verify', 'email', input.email), {
    windowMs: 60_000,
    max: 10,
  })
  if (!emailLimit.ok) return emailLimit
  const ipLimit = await rateLimit(`otp-verify:ip:${ip}`, { windowMs: 60_000, max: 50 })
  if (!ipLimit.ok) return ipLimit

  return authProvider.verifyOtp({ email: input.email, token: input.token })
}

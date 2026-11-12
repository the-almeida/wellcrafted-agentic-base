import { rateLimit, rateLimitKey } from '@/shared/lib/rate-limit'

import type { PublicAuthContext } from '../public-auth-context'

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
  const emailLimit = await rateLimit(rateLimitKey('otp-sign-in', 'email', input.email), {
    windowMs: 60_000,
    max: 5,
  })
  if (!emailLimit.ok) return emailLimit
  const ipLimit = await rateLimit(`otp-sign-in:ip:${ip}`, { windowMs: 60_000, max: 30 })
  if (!ipLimit.ok) return ipLimit

  return authProvider.requestSignInOtp({ email: input.email })
}

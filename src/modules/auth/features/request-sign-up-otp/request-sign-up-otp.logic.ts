import { rateLimit, rateLimitKey } from '@/shared/lib/rate-limit'

import type { PublicAuthContext } from '../public-auth-context'

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
  const emailLimit = await rateLimit(rateLimitKey('otp-sign-up', 'email', input.email), {
    windowMs: 60_000,
    max: 5,
  })
  if (!emailLimit.ok) return emailLimit
  const ipLimit = await rateLimit(`otp-sign-up:ip:${ip}`, { windowMs: 60_000, max: 30 })
  if (!ipLimit.ok) return ipLimit

  return authProvider.requestSignUpOtp({ email: input.email, name: input.name })
}

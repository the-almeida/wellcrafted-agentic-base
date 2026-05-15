'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { getRequestIp } from '@/shared/lib/http/request-ip'
import { rateLimit } from '@/shared/lib/rate-limit'
import { err } from '@/shared/lib/result'

import { authProvider } from '../../adapters/auth-provider.supabase'

import { verifyOtpSchema } from './verify-otp.schema'

/**
 * Verifies a 6-digit OTP code and establishes a session.
 *
 * Used by both sign-in and sign-up flows — Supabase doesn't distinguish.
 * The form layer fires the appropriate analytics event (`user_signed_up`
 * vs `user_signed_in`) because it knows which page it's on.
 *
 * Rate-limited per-email to slow code brute-forcing on top of Supabase's
 * own OTP attempt limits.
 */
export const verifyOtp = withErrorBoundary(async (raw: unknown) => {
  const parsed = verifyOtpSchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  const emailLimit = await rateLimit(`otp-verify:email:${parsed.data.email}`, {
    windowMs: 60_000,
    max: 10,
  })
  if (!emailLimit.ok) return emailLimit
  const ip = await getRequestIp()
  const ipLimit = await rateLimit(`otp-verify:ip:${ip}`, { windowMs: 60_000, max: 50 })
  if (!ipLimit.ok) return ipLimit

  return authProvider.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
  })
})

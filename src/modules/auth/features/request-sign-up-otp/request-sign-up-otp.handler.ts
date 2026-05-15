'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { getRequestIp } from '@/shared/lib/http/request-ip'
import { rateLimit } from '@/shared/lib/rate-limit'
import { err } from '@/shared/lib/result'

import { authProvider } from '../../adapters/auth-provider.supabase'

import { requestSignUpOtpSchema } from './request-sign-up-otp.schema'

/**
 * Sends a 6-digit OTP code, auto-creating the user on first request.
 *
 * `name` rides in `raw_user_meta_data`; the public.users sync trigger
 * picks it up. If the email already exists, Supabase still sends the
 * code but the existing user's name is preserved (trigger uses ON
 * CONFLICT DO NOTHING).
 */
export const requestSignUpOtp = withErrorBoundary(async (raw: unknown) => {
  const parsed = requestSignUpOtpSchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  const emailLimit = await rateLimit(`otp-sign-up:email:${parsed.data.email}`, {
    windowMs: 60_000,
    max: 5,
  })
  if (!emailLimit.ok) return emailLimit
  const ip = await getRequestIp()
  const ipLimit = await rateLimit(`otp-sign-up:ip:${ip}`, { windowMs: 60_000, max: 30 })
  if (!ipLimit.ok) return ipLimit

  return authProvider.requestSignUpOtp({
    email: parsed.data.email,
    name: parsed.data.name,
  })
})

'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { getRequestIp } from '@/shared/lib/http/request-ip'
import { rateLimit } from '@/shared/lib/rate-limit'
import { err } from '@/shared/lib/result'

import { authProvider } from '../../adapters/auth-provider.supabase'

import { requestSignInOtpSchema } from './request-sign-in-otp.schema'

/**
 * Sends a 6-digit OTP code to an existing user.
 *
 * `shouldCreateUser: false` is enforced at the adapter; an unknown email
 * returns an UnauthenticatedError. This is deliberate — we never want
 * a sign-in page to silently create accounts.
 */
export const requestSignInOtp = withErrorBoundary(async (raw: unknown) => {
  const parsed = requestSignInOtpSchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  const emailLimit = await rateLimit(`otp-sign-in:email:${parsed.data.email}`, {
    windowMs: 60_000,
    max: 5,
  })
  if (!emailLimit.ok) return emailLimit
  const ip = await getRequestIp()
  const ipLimit = await rateLimit(`otp-sign-in:ip:${ip}`, { windowMs: 60_000, max: 30 })
  if (!ipLimit.ok) return ipLimit

  return authProvider.requestSignInOtp({ email: parsed.data.email })
})

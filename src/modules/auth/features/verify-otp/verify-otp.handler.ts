'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { getRequestIp } from '@/shared/lib/http/request-ip'
import { err } from '@/shared/lib/result'

import { authProvider } from '../../adapters/auth-provider.supabase'

import { verifyOtpWith } from './verify-otp.logic'
import { verifyOtpSchema } from './verify-otp.schema'

export const verifyOtp = withErrorBoundary(async (raw: unknown) => {
  const parsed = verifyOtpSchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  return verifyOtpWith({ authProvider, ip: await getRequestIp() }, parsed.data)
})

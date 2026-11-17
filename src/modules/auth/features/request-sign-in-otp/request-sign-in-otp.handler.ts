'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { getRequestIp } from '@/shared/lib/http/request-ip'
import { err } from '@/shared/lib/result'

import { authProvider } from '../../adapters/auth-provider.supabase'

import { requestSignInOtpWith } from './request-sign-in-otp.logic'
import { requestSignInOtpSchema } from './request-sign-in-otp.schema'

export const requestSignInOtp = withErrorBoundary(async (raw: unknown) => {
  const parsed = requestSignInOtpSchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  return requestSignInOtpWith({ authProvider, ip: await getRequestIp() }, parsed.data)
})

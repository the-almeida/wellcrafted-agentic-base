'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { getRequestIp } from '@/shared/lib/http/request-ip'
import { err } from '@/shared/lib/result'

import { authProvider } from '../../adapters/auth-provider.supabase'

import { requestSignUpOtpWith } from './request-sign-up-otp.logic'
import { requestSignUpOtpSchema } from './request-sign-up-otp.schema'

export const requestSignUpOtp = withErrorBoundary(async (raw: unknown) => {
  const parsed = requestSignUpOtpSchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  return requestSignUpOtpWith({ authProvider, ip: await getRequestIp() }, parsed.data)
})

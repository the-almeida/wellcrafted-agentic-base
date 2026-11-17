'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { getRequestIp } from '@/shared/lib/http/request-ip'
import { err } from '@/shared/lib/result'

import { authProvider } from '../../adapters/auth-provider.supabase'

import { signUpWith } from './sign-up.logic'
import { signUpSchema } from './sign-up.schema'

export const signUp = withErrorBoundary(async (raw: unknown) => {
  const parsed = signUpSchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  return signUpWith({ authProvider, ip: await getRequestIp() }, parsed.data)
})

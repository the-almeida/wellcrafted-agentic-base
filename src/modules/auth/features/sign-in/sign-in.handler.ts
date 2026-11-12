'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { getRequestIp } from '@/shared/lib/http/request-ip'
import { err } from '@/shared/lib/result'

import { authProvider } from '../../adapters/auth-provider.supabase'

import { signInWith } from './sign-in.logic'
import { signInSchema } from './sign-in.schema'

export const signIn = withErrorBoundary(async (raw: unknown) => {
  const parsed = signInSchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  return signInWith({ authProvider, ip: await getRequestIp() }, parsed.data)
})

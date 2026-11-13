'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { rateLimit } from '@/shared/lib/rate-limit'
import { err } from '@/shared/lib/result'

import { authProvider } from '../../adapters/auth-provider.supabase'
import { requireUser } from '../../require-user'

import { setPasswordWith } from './set-password.logic'
import { setPasswordSchema } from './set-password.schema'

export const setPassword = withErrorBoundary(async (raw: unknown) => {
  const userResult = await requireUser()
  if (!userResult.ok) return userResult

  const parsed = setPasswordSchema.safeParse(raw)
  if (!parsed.success) return err(new ValidationError(parsed.error.flatten()))

  const limit = await rateLimit(`account:set-password:${userResult.value.id}`, {
    windowMs: 60 * 60 * 1000,
    max: 10,
  })
  if (!limit.ok) return limit

  return setPasswordWith({ authProvider }, userResult.value.id, parsed.data)
})

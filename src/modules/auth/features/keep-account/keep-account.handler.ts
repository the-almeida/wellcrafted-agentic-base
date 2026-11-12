'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { rateLimit } from '@/shared/lib/rate-limit'
import { err, ok } from '@/shared/lib/result'

import { authProvider } from '../../adapters/auth-provider.supabase'
import { requireUser } from '../../require-user'

import { keepAccountWith } from './keep-account.logic'
import { keepAccountSchema } from './keep-account.schema'

/** "Keep your account": an anonymous account adds an email and password. */
export const keepAccount = withErrorBoundary(async (raw: unknown) => {
  const userResult = await requireUser({ allow: ['anonymous'] })
  if (!userResult.ok) return userResult

  const parsed = keepAccountSchema.safeParse(raw)
  if (!parsed.success) return err(new ValidationError(parsed.error.flatten()))

  // Each try asks Supabase whether the email is free: bound how many
  // addresses one account can probe.
  const limit = await rateLimit(`account:keep:${userResult.value.id}`, {
    windowMs: 60 * 60 * 1000,
    max: 5,
  })
  if (!limit.ok) return limit

  const result = await keepAccountWith({ authProvider }, userResult.value, parsed.data)
  return result.ok ? ok(undefined) : result
})

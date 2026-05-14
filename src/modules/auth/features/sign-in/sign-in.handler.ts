'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { rateLimit } from '@/shared/lib/rate-limit'
import { err, ok } from '@/shared/lib/result'
import { Events } from '@/shared/observability/analytics/events'
import { track } from '@/shared/observability/analytics/track'

import { authProvider } from '../../adapters/auth-provider.supabase'
import { userRepository } from '../../adapters/user-repository.drizzle'

import { signInSchema } from './sign-in.schema'

export const signIn = withErrorBoundary(async (raw: unknown) => {
  const parsed = signInSchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  const limited = await rateLimit(`sign-in:${parsed.data.email}`, {
    windowMs: 60_000,
    max: 10,
  })
  if (!limited.ok) return limited

  const result = await authProvider.signInWithPassword(parsed.data)
  if (!result.ok) return result

  const user = await userRepository.findById(result.value.userId)
  if (!user) {
    return err(new ValidationError({}, 'authenticated user has no matching profile'))
  }

  track(Events.USER_SIGNED_IN, { method: 'email' })
  return ok(user)
})

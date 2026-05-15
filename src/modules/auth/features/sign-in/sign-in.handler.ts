'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { getRequestIp } from '@/shared/lib/http/request-ip'
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

  const emailLimit = await rateLimit(`sign-in:email:${parsed.data.email}`, {
    windowMs: 60_000,
    max: 10,
  })
  if (!emailLimit.ok) return emailLimit
  const ip = await getRequestIp()
  const ipLimit = await rateLimit(`sign-in:ip:${ip}`, { windowMs: 60_000, max: 30 })
  if (!ipLimit.ok) return ipLimit

  const result = await authProvider.signInWithPassword(parsed.data)
  if (!result.ok) return result

  const user = await userRepository.findById(result.value.userId)
  if (!user) {
    return err(new ValidationError({}, 'authenticated user has no matching profile'))
  }

  track(Events.USER_SIGNED_IN, { method: 'email' })
  return ok(user)
})

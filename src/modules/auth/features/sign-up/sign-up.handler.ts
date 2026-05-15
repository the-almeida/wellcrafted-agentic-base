'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { getRequestIp } from '@/shared/lib/http/request-ip'
import { rateLimit } from '@/shared/lib/rate-limit'
import { err, ok } from '@/shared/lib/result'
import { Events } from '@/shared/observability/analytics/events'
import { track } from '@/shared/observability/analytics/track'

import { authProvider } from '../../adapters/auth-provider.supabase'

import { signUpSchema } from './sign-up.schema'

export const signUp = withErrorBoundary(async (raw: unknown) => {
  const parsed = signUpSchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  const emailLimit = await rateLimit(`sign-up:email:${parsed.data.email}`, {
    windowMs: 60_000,
    max: 5,
  })
  if (!emailLimit.ok) return emailLimit
  const ip = await getRequestIp()
  const ipLimit = await rateLimit(`sign-up:ip:${ip}`, { windowMs: 60_000, max: 30 })
  if (!ipLimit.ok) return ipLimit

  const result = await authProvider.signUpWithPassword(parsed.data)
  if (!result.ok) return result

  track(Events.USER_SIGNED_UP, { method: 'email' })
  return ok(result.value)
})

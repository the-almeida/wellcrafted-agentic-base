import { rateLimit, rateLimitKey } from '@/shared/lib/rate-limit'
import { ok } from '@/shared/lib/result'
import { Events } from '@/shared/observability/analytics/events'
import { track } from '@/shared/observability/analytics/track'

import type { PublicAuthContext } from '../public-auth-context'

import type { SignUpInput } from './sign-up.schema'

export async function signUpWith({ authProvider, ip }: PublicAuthContext, input: SignUpInput) {
  const emailLimit = await rateLimit(rateLimitKey('sign-up', 'email', input.email), {
    windowMs: 60_000,
    max: 5,
  })
  if (!emailLimit.ok) return emailLimit
  const ipLimit = await rateLimit(`sign-up:ip:${ip}`, { windowMs: 60_000, max: 30 })
  if (!ipLimit.ok) return ipLimit

  const result = await authProvider.signUpWithPassword(input)
  if (!result.ok) return result

  track(Events.USER_SIGNED_UP, { method: 'email' })
  return ok(result.value)
}

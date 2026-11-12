import { ValidationError } from '@/shared/lib/errors/base'
import { rateLimit, rateLimitKey } from '@/shared/lib/rate-limit'
import { err, ok } from '@/shared/lib/result'
import { Events } from '@/shared/observability/analytics/events'
import { track } from '@/shared/observability/analytics/track'

import { userRepository } from '../../adapters/user-repository.drizzle'
import type { PublicAuthContext } from '../public-auth-context'

import type { SignInInput } from './sign-in.schema'

export async function signInWith({ authProvider, ip }: PublicAuthContext, input: SignInInput) {
  const emailLimit = await rateLimit(rateLimitKey('sign-in', 'email', input.email), {
    windowMs: 60_000,
    max: 10,
  })
  if (!emailLimit.ok) return emailLimit
  const ipLimit = await rateLimit(`sign-in:ip:${ip}`, { windowMs: 60_000, max: 30 })
  if (!ipLimit.ok) return ipLimit

  const result = await authProvider.signInWithPassword(input)
  if (!result.ok) return result

  const user = await userRepository.findById(result.value.userId)
  if (!user) {
    return err(new ValidationError({}, 'authenticated user has no matching profile'))
  }

  track(Events.USER_SIGNED_IN, { method: 'email' })
  return ok(user)
}

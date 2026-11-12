import { ok } from '@/shared/lib/result'
import { Events } from '@/shared/observability/analytics/events'
import { track } from '@/shared/observability/analytics/track'

import { userRepository } from '../../adapters/user-repository.drizzle'
import type { PublicAuthContext } from '../public-auth-context'
import { limitPublicAuthCall } from '../public-auth-rate-limits'

import type { SignInInput } from './sign-in.schema'

export async function signInWith({ authProvider, ip }: PublicAuthContext, input: SignInInput) {
  const limited = await limitPublicAuthCall(
    'sign-in',
    { ip, email: input.email },
    { perIp: 30, perEmail: 10 },
  )
  if (!limited.ok) return limited

  const result = await authProvider.signInWithPassword(input)
  if (!result.ok) return result

  const user = await userRepository.findById(result.value.userId)
  if (!user) {
    // The auth trigger creates this row with the account, in one
    // transaction: a missing row is a bug. Thrown so withErrorBoundary logs
    // it and reports it to Sentry; the session stays, but requireUser
    // fails closed for an account without a row.
    throw new Error(`auth user ${result.value.userId} has no public.users row`)
  }

  track(Events.USER_SIGNED_IN, { method: 'email' })
  return ok(user)
}

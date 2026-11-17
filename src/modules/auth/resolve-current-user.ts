import { cache } from 'react'

import { authProvider } from './adapters/auth-provider.supabase'
import { userRepository } from './adapters/user-repository.drizzle'
import type { User } from './domain/user'

export type CurrentUser =
  | { status: 'signed-out' }
  | { status: 'no-record' }
  | { status: 'signed-in'; user: User }

/**
 * Resolves the signed-in user and their account state: one call to the
 * Supabase auth API (`getUser()`, which verifies the JWT) and one DB query.
 *
 * Memoized per React Server Components render only (React `cache`), so a
 * layout and its page share one resolution. Server actions and route
 * handlers are not inside a render, so they always resolve fresh and never
 * see state from before their own writes.
 *
 * Module-private: callers use `requireUser` or `getOptionalUser`.
 */
export const resolveCurrentUser = cache(async (): Promise<CurrentUser> => {
  const identity = await authProvider.getCurrentIdentity()
  if (!identity) return { status: 'signed-out' }
  const user = await userRepository.findById(identity.userId)
  if (!user) return { status: 'no-record' }
  return { status: 'signed-in', user }
})

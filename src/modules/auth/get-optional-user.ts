import { authProvider } from './adapters/auth-provider.supabase'
import { userRepository } from './adapters/user-repository.drizzle'
import type { User } from './domain/user'

/**
 * Returns the current user when authenticated, or `null` when not. Use this
 * for pages that render differently for guests vs signed-in users (sign-in
 * page redirect-when-already-authed, headers with avatar menu, landing
 * personalization).
 *
 * For protected routes that should reject anonymous callers, use
 * `requireUser` instead.
 */
export async function getOptionalUser(): Promise<User | null> {
  const identity = await authProvider.getCurrentIdentity()
  if (!identity) return null
  return userRepository.findById(identity.userId)
}

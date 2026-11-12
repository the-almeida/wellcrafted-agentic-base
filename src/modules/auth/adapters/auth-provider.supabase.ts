import type { SupabaseClient } from '@supabase/supabase-js'

import { ExternalServiceError, ValidationError } from '@/shared/lib/errors/base'
import { UserIdSchema } from '@/shared/lib/ids'
import { err, ok, type Result } from '@/shared/lib/result'

import { AUTH_ERROR_MESSAGES, type AuthIdentity, type AuthProvider } from '../ports/auth-provider'

import { createSupabaseServerClient } from './supabase/server-client'
import { answersAsCodeSent, mapSupabaseAuthError } from './supabase-auth-errors'

function identityFromUser(supaUser: {
  id: string
  email?: string | null
}): Result<AuthIdentity, ValidationError> {
  if (!supaUser.email) {
    return err(new ValidationError({ field: 'email' }, 'auth user has no email'))
  }
  const idParsed = UserIdSchema.safeParse(supaUser.id)
  if (!idParsed.success) {
    return err(new ValidationError(idParsed.error.flatten(), 'auth user id is not a uuid'))
  }
  return ok({ userId: idParsed.data, email: supaUser.email })
}

/**
 * The Supabase implementation of `AuthProvider`. `getClient` returns the
 * Supabase client to use for each call: in the app, the server client bound
 * to the request's cookies; in the contract test, a client over an
 * in-memory cookie jar.
 */
export function createSupabaseAuthProvider(getClient: () => Promise<SupabaseClient>): AuthProvider {
  return {
    async signInWithPassword({ email, password }) {
      const supabase = await getClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return err(mapSupabaseAuthError('sign-in', error))
      return identityFromUser(data.user)
    },
    async signUpWithPassword({ email, password, name }) {
      const supabase = await getClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (error) return err(mapSupabaseAuthError('sign-up', error))
      if (!data.user) {
        return err(new ExternalServiceError('supabase', AUTH_ERROR_MESSAGES.unavailable))
      }
      return identityFromUser(data.user)
    },
    async requestSignInOtp({ email }) {
      const supabase = await getClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      // An unknown email answers like a known one (no code is sent), so the
      // sign-in page cannot be used to find out who has an account.
      if (error && !answersAsCodeSent('sign-in', error)) {
        return err(mapSupabaseAuthError('otp-request', error))
      }
      return ok(undefined)
    },
    async requestSignUpOtp({ email, name }) {
      const supabase = await getClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { data: { name }, shouldCreateUser: true },
      })
      if (error && !answersAsCodeSent('sign-up', error)) {
        return err(mapSupabaseAuthError('otp-request', error))
      }
      return ok(undefined)
    },
    async verifyOtp({ email, token }) {
      const supabase = await getClient()
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (error) return err(mapSupabaseAuthError('verify', error))
      if (!data.user) {
        return err(new ExternalServiceError('supabase', AUTH_ERROR_MESSAGES.unavailable))
      }
      return identityFromUser(data.user)
    },
    async signOut() {
      const supabase = await getClient()
      const { error } = await supabase.auth.signOut()
      if (error) return err(mapSupabaseAuthError('sign-out', error))
      return ok(undefined)
    },
    async getCurrentIdentity() {
      const supabase = await getClient()
      // The SDK throws `AuthApiError` (e.g. refresh_token_not_found) for
      // anonymous traffic and stale-cookie refreshes. Treat any such failure
      // as "no current user"; real failures will surface at the next sign-in.
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) return null
        const result = identityFromUser(data.user)
        return result.ok ? result.value : null
      } catch {
        return null
      }
    },
  }
}

export const authProvider = createSupabaseAuthProvider(createSupabaseServerClient)

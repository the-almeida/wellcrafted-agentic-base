import type { SupabaseClient } from '@supabase/supabase-js'

import {
  ExternalServiceError,
  UnauthenticatedError,
  ValidationError,
} from '@/shared/lib/errors/base'
import { UserIdSchema } from '@/shared/lib/ids'
import { err, ok, type Result } from '@/shared/lib/result'

import { AUTH_ERROR_MESSAGES, type AuthIdentity, type AuthProvider } from '../ports/auth-provider'

import { createSupabaseServerClient } from './supabase/server-client'
import { mapSupabaseAuthError } from './supabase-auth-errors'

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
      if (error) {
        // Supabase returns "Signups not allowed for otp" when the email is
        // not registered and shouldCreateUser=false. We surface this
        // verbatim, which means a caller can probe whether an email is
        // registered. Accepted trade-off — see `docs/conventions.md` →
        // "Auth: accepted trade-offs". If your project handles sensitive
        // accounts, normalize this to always return ok(undefined) and
        // show a generic "if an account exists, we sent a code" message.
        return err(new UnauthenticatedError(error.message, { cause: error }))
      }
      return ok(undefined)
    },
    async requestSignUpOtp({ email, name }) {
      const supabase = await getClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { data: { name }, shouldCreateUser: true },
      })
      if (error) return err(mapSupabaseAuthError('otp-request', error))
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

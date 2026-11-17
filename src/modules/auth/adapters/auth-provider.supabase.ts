import type { SupabaseClient } from '@supabase/supabase-js'

import { ExternalServiceError } from '@/shared/lib/errors/base'
import { err, ok } from '@/shared/lib/result'

import { AUTH_ERROR_MESSAGES, type AuthProvider } from '../ports/auth-provider'

import { createSupabaseServerClient } from './supabase/server-client'
import { answersAsCodeSent, mapSupabaseAuthError } from './supabase-auth-errors'
import { identityFromSupabaseUser } from './supabase-identity'

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
      return identityFromSupabaseUser(data.user)
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
      return identityFromSupabaseUser(data.user)
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
      return identityFromSupabaseUser(data.user)
    },
    async exchangeOAuthCode(code) {
      // Uses the PKCE verifier cookie set by signInWithOAuth and writes the
      // session cookies on the app origin.
      const supabase = await getClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) return err(mapSupabaseAuthError('oauth', error))
      return identityFromSupabaseUser(data.user)
    },
    async addEmailAndPassword({ email, password }) {
      const supabase = await getClient()
      const { data, error } = await supabase.auth.updateUser({ email, password })
      if (error) return err(mapSupabaseAuthError('add-email', error))
      return identityFromSupabaseUser(data.user)
    },
    async replacePassword({ password }) {
      const supabase = await getClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return err(mapSupabaseAuthError('replace-password', error))
      return ok(undefined)
    },
    async currentSessionId() {
      const supabase = await getClient()
      // Verifies the access token and reads its session_id claim.
      try {
        const { data } = await supabase.auth.getClaims()
        const sessionId: unknown = data?.claims.session_id
        return typeof sessionId === 'string' ? sessionId : null
      } catch {
        return null
      }
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
        const result = identityFromSupabaseUser(data.user)
        return result.ok ? result.value : null
      } catch {
        return null
      }
    },
  }
}

export const authProvider = createSupabaseAuthProvider(createSupabaseServerClient)

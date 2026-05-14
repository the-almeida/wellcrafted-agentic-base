import {
  ExternalServiceError,
  UnauthenticatedError,
  ValidationError,
} from '@/shared/lib/errors/base'
import { UserIdSchema } from '@/shared/lib/ids'
import { err, ok, type Result } from '@/shared/lib/result'

import type { AuthIdentity, AuthProvider } from '../ports/auth-provider'

import { createSupabaseServerClient } from './supabase/server-client'

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

export const authProvider: AuthProvider = {
  async signInWithPassword({ email, password }) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return err(new UnauthenticatedError(error.message, { cause: error }))
    return identityFromUser(data.user)
  },
  async signUpWithPassword({ email, password, name }) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: name ? { name } : undefined },
    })
    if (error) {
      return err(new ExternalServiceError('supabase', error.message, { cause: error }))
    }
    if (!data.user) {
      return err(new ExternalServiceError('supabase', 'sign-up did not return a user'))
    }
    return identityFromUser(data.user)
  },
  async signOut() {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signOut()
    if (error) return err(new ExternalServiceError('supabase', error.message, { cause: error }))
    return ok(undefined)
  },
  async getCurrentIdentity() {
    const supabase = await createSupabaseServerClient()
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

import type {
  ExternalServiceError,
  UnauthenticatedError,
  ValidationError,
} from '@/shared/lib/errors/base'
import type { UserId } from '@/shared/lib/ids'
import type { Result } from '@/shared/lib/result'

export type OAuthProvider = 'google' | 'facebook'

export type AuthIdentity = {
  userId: UserId
  email: string
}

export type AuthError = UnauthenticatedError | ValidationError | ExternalServiceError

export type AuthProvider = {
  signInWithPassword(input: {
    email: string
    password: string
  }): Promise<Result<AuthIdentity, AuthError>>
  signUpWithPassword(input: {
    email: string
    password: string
    name: string
  }): Promise<Result<AuthIdentity, AuthError>>
  /**
   * Sends a 6-digit code to an EXISTING user. `shouldCreateUser: false`
   * prevents accidental account creation through the sign-in page; an
   * unknown email returns an UnauthenticatedError, not a sent code.
   */
  requestSignInOtp(input: { email: string }): Promise<Result<void, AuthError>>
  /**
   * Sends a 6-digit code and auto-creates the user on first request
   * (`shouldCreateUser: true`). `name` lands in `raw_user_meta_data`
   * which the public.users sync trigger consumes.
   */
  requestSignUpOtp(input: { email: string; name: string }): Promise<Result<void, AuthError>>
  verifyOtp(input: { email: string; token: string }): Promise<Result<AuthIdentity, AuthError>>
  signOut(): Promise<Result<void, ExternalServiceError>>
  getCurrentIdentity(): Promise<AuthIdentity | null>
}

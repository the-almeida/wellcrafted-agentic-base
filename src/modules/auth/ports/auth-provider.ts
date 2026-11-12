import type {
  ExternalServiceError,
  UnauthenticatedError,
  ValidationError,
} from '@/shared/lib/errors/base'
import type { RateLimitExceededError } from '@/shared/lib/rate-limit'
import type { UserId } from '@/shared/lib/ids'
import type { Result } from '@/shared/lib/result'

export type OAuthProvider = 'google' | 'facebook'

export type AuthIdentity = {
  userId: UserId
  email: string
}

export type AuthError =
  | UnauthenticatedError
  | ValidationError
  | ExternalServiceError
  | RateLimitExceededError

/**
 * The only messages an `AuthProvider` returns: they reach the browser, so
 * they never carry the provider's own text (which can reveal whether an
 * email has an account). The provider's error stays in `cause`. Every
 * implementation uses these, and the contract suite checks them.
 */
export const AUTH_ERROR_MESSAGES = {
  invalidCredentials: 'Invalid email or password.',
  invalidCode: 'Invalid or expired code.',
  signUpFailed: 'Could not create the account. If you already have one, sign in.',
  tooManyAttempts: 'Too many attempts. Wait a minute and try again.',
  unavailable: 'Sign-in is unavailable right now. Try again.',
} as const

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
  signOut(): Promise<Result<void, AuthError>>
  getCurrentIdentity(): Promise<AuthIdentity | null>
}

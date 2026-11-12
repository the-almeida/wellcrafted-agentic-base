import type {
  ConflictError,
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
  /** Null only for anonymous accounts. */
  email: string | null
  isAnonymous: boolean
}

export type AuthError =
  | ConflictError
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
  emailUnavailable: 'This email cannot be used. If it is yours, sign in with it instead.',
  samePassword: 'Choose a password different from the current one.',
  weakPassword: 'Choose a longer password.',
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
   * Sends a 6-digit code to an EXISTING user, and never creates an account
   * (`shouldCreateUser: false`). An unknown email answers `ok` like a known
   * one, but nothing is sent: a different answer would tell anyone which
   * emails have accounts.
   */
  requestSignInOtp(input: { email: string }): Promise<Result<void, AuthError>>
  /**
   * Sends a 6-digit code and auto-creates the user on first request
   * (`shouldCreateUser: true`). `name` lands in `raw_user_meta_data`
   * which the public.users sync trigger consumes.
   */
  requestSignUpOtp(input: { email: string; name: string }): Promise<Result<void, AuthError>>
  verifyOtp(input: { email: string; token: string }): Promise<Result<AuthIdentity, AuthError>>
  /**
   * Finishes an OAuth sign-in: trades the code the provider sent back to the
   * app's callback for a session, and returns who signed in.
   */
  exchangeOAuthCode(code: string): Promise<Result<AuthIdentity, AuthError>>
  /**
   * Makes the signed-in anonymous account permanent: same id, now with this
   * email and password. Takes effect at once, with no code, while email
   * confirmations are off (the email is not verified). An email another
   * account has answers CONFLICT and leaves the account anonymous.
   */
  addEmailAndPassword(input: {
    email: string
    password: string
  }): Promise<Result<AuthIdentity, AuthError>>
  /** Sets a new password for the signed-in account. */
  replacePassword(input: { password: string }): Promise<Result<void, AuthError>>
  /** Signs the account out everywhere except this session. */
  endOtherSessions(): Promise<Result<void, AuthError>>
  signOut(): Promise<Result<void, AuthError>>
  getCurrentIdentity(): Promise<AuthIdentity | null>
}

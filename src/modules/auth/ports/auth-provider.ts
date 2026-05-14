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
    name?: string
  }): Promise<Result<AuthIdentity, AuthError>>
  signOut(): Promise<Result<void, ExternalServiceError>>
  getCurrentIdentity(): Promise<AuthIdentity | null>
}

import { randomInt, randomUUID } from 'node:crypto'

import { ExternalServiceError, UnauthenticatedError } from '@/shared/lib/errors/base'
import { UserIdSchema, type UserId } from '@/shared/lib/ids'
import { err, ok } from '@/shared/lib/result'

import { AUTH_ERROR_MESSAGES, type AuthIdentity, type AuthProvider } from '../ports/auth-provider'

/**
 * In-memory stand-in for Supabase Auth, for tests only. It is held to the
 * same contract as the Supabase adapter (auth-provider.contract.test-helper.ts),
 * which runs against both, so tests that use it test real behavior.
 *
 * One `createFakeAuth()` is one auth service (one Supabase project); each
 * `newSession()` is one browser, with its own current identity.
 *
 * Never import this from production code (lint forbids it): it signs anyone in.
 */
export function createFakeAuth() {
  // Lint stops static imports from production code; this also stops
  // dynamic ones, and anything else that slips past it.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The fake auth provider is for tests only; it signs anyone in.')
  }

  type Account = { identity: AuthIdentity; password: string | null }
  const accounts = new Map<string, Account>()
  const codes = new Map<string, string>()

  const key = (email: string) => email.trim().toLowerCase()

  function createAccount(email: string, password: string | null, userId?: UserId): Account {
    const account: Account = {
      identity: { userId: userId ?? UserIdSchema.parse(randomUUID()), email: key(email) },
      password,
    }
    accounts.set(key(email), account)
    return account
  }

  function sendCode(email: string) {
    codes.set(key(email), String(randomInt(0, 1_000_000)).padStart(6, '0'))
  }

  return {
    newSession(): AuthProvider {
      let current: AuthIdentity | null = null

      return {
        async signInWithPassword({ email, password }) {
          const account = accounts.get(key(email))
          if (!account || account.password !== password) {
            return err(new UnauthenticatedError(AUTH_ERROR_MESSAGES.invalidCredentials))
          }
          current = account.identity
          return ok(account.identity)
        },
        async signUpWithPassword({ email, password }) {
          if (accounts.has(key(email))) {
            return err(new ExternalServiceError('supabase', AUTH_ERROR_MESSAGES.signUpFailed))
          }
          current = createAccount(email, password).identity
          return ok(current)
        },
        async requestSignInOtp({ email }) {
          if (!accounts.has(key(email))) {
            return err(new UnauthenticatedError('Signups not allowed for otp'))
          }
          sendCode(email)
          return ok(undefined)
        },
        async requestSignUpOtp({ email }) {
          // Like Supabase with shouldCreateUser: the account exists from
          // the request on; the code confirms it.
          if (!accounts.has(key(email))) createAccount(email, null)
          sendCode(email)
          return ok(undefined)
        },
        async verifyOtp({ email, token }) {
          const account = accounts.get(key(email))
          if (!account || codes.get(key(email)) !== token) {
            return err(new UnauthenticatedError(AUTH_ERROR_MESSAGES.invalidCode))
          }
          codes.delete(key(email))
          current = account.identity
          return ok(account.identity)
        },
        async signOut() {
          current = null
          return ok(undefined)
        },
        async getCurrentIdentity() {
          return current
        },
      }
    },

    /**
     * Setup only (not part of the contract): a confirmed account. Pass the
     * id of a real auth user when the test also needs its public.users row.
     */
    addUser({
      email,
      password,
      userId,
    }: {
      email: string
      password: string
      userId?: UserId
    }): AuthIdentity {
      return createAccount(email, password, userId).identity
    },

    /** The code most recently "emailed" to this address. */
    lastCodeSentTo(email: string): string {
      const code = codes.get(key(email))
      if (!code) throw new Error(`no code was sent to ${email}`)
      return code
    },
  }
}

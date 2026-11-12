import { randomInt, randomUUID } from 'node:crypto'

import {
  ConflictError,
  ExternalServiceError,
  UnauthenticatedError,
  ValidationError,
} from '@/shared/lib/errors/base'
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
  // By id; permanent accounts are also found by email.
  const accounts = new Map<UserId, Account>()
  const byEmail = new Map<string, UserId>()
  const codes = new Map<string, string>()
  const oauthCodes = new Map<string, string>()
  // Live sessions per account: ending one signs that browser out.
  const sessions = new Map<UserId, Set<symbol>>()

  const key = (email: string) => email.trim().toLowerCase()
  const findByEmail = (email: string) => {
    const id = byEmail.get(key(email))
    return id ? accounts.get(id) : undefined
  }

  function createAccount(email: string | null, password: string | null, userId?: UserId): Account {
    const account: Account = {
      identity: {
        userId: userId ?? UserIdSchema.parse(randomUUID()),
        email: email === null ? null : key(email),
        isAnonymous: email === null,
      },
      password,
    }
    accounts.set(account.identity.userId, account)
    if (email !== null) byEmail.set(key(email), account.identity.userId)
    return account
  }

  function sendCode(email: string) {
    codes.set(key(email), String(randomInt(0, 1_000_000)).padStart(6, '0'))
  }

  function newSession(): AuthProvider & { signInAs(account: Account): void } {
    const token = Symbol('session')
    let currentId: UserId | null = null

    const current = () => {
      if (!currentId || !sessions.get(currentId)?.has(token)) return null
      return accounts.get(currentId) ?? null
    }
    function signInAs(account: Account) {
      currentId = account.identity.userId
      const live = sessions.get(currentId) ?? new Set()
      live.add(token)
      sessions.set(currentId, live)
    }

    return {
      signInAs,
      async signInWithPassword({ email, password }) {
        const account = findByEmail(email)
        if (!account || account.password !== password) {
          return err(new UnauthenticatedError(AUTH_ERROR_MESSAGES.invalidCredentials))
        }
        signInAs(account)
        return ok(account.identity)
      },
      async signUpWithPassword({ email, password }) {
        if (findByEmail(email)) {
          return err(new ExternalServiceError('supabase', AUTH_ERROR_MESSAGES.signUpFailed))
        }
        const account = createAccount(email, password)
        signInAs(account)
        return ok(account.identity)
      },
      async requestSignInOtp({ email }) {
        // Same answer either way; only real accounts get a code.
        if (findByEmail(email)) sendCode(email)
        return ok(undefined)
      },
      async requestSignUpOtp({ email }) {
        // Like Supabase with shouldCreateUser: the account exists from
        // the request on; the code confirms it.
        if (!findByEmail(email)) createAccount(email, null)
        sendCode(email)
        return ok(undefined)
      },
      async verifyOtp({ email, token: code }) {
        const account = findByEmail(email)
        if (!account || codes.get(key(email)) !== code) {
          return err(new UnauthenticatedError(AUTH_ERROR_MESSAGES.invalidCode))
        }
        codes.delete(key(email))
        signInAs(account)
        return ok(account.identity)
      },
      async exchangeOAuthCode(code) {
        const email = oauthCodes.get(code)
        const account = email ? findByEmail(email) : undefined
        if (!account) {
          return err(new ExternalServiceError('supabase', AUTH_ERROR_MESSAGES.unavailable))
        }
        oauthCodes.delete(code)
        signInAs(account)
        return ok(account.identity)
      },
      async addEmailAndPassword({ email, password }) {
        const account = current()
        if (!account) return err(new UnauthenticatedError(AUTH_ERROR_MESSAGES.unavailable))
        if (findByEmail(email)) return err(new ConflictError(AUTH_ERROR_MESSAGES.emailUnavailable))
        account.identity = { ...account.identity, email: key(email), isAnonymous: false }
        account.password = password
        byEmail.set(key(email), account.identity.userId)
        return ok(account.identity)
      },
      async replacePassword({ password }) {
        const account = current()
        if (!account) return err(new UnauthenticatedError(AUTH_ERROR_MESSAGES.unavailable))
        if (account.password === password) {
          return err(
            new ValidationError(
              { formErrors: [], fieldErrors: {} },
              AUTH_ERROR_MESSAGES.samePassword,
            ),
          )
        }
        account.password = password
        return ok(undefined)
      },
      async endOtherSessions() {
        const account = current()
        if (!account) return err(new UnauthenticatedError(AUTH_ERROR_MESSAGES.unavailable))
        sessions.set(account.identity.userId, new Set([token]))
        return ok(undefined)
      },
      async signOut() {
        if (currentId) sessions.get(currentId)?.delete(token)
        currentId = null
        return ok(undefined)
      },
      async getCurrentIdentity() {
        return current()?.identity ?? null
      },
    }
  }

  return {
    newSession: (): AuthProvider => newSession(),

    /** Setup only: a session signed in anonymously, as the browser would. */
    newAnonymousSession(): AuthProvider {
      const session = newSession()
      session.signInAs(createAccount(null, null))
      return session
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

    /**
     * Setup only: an OAuth code as a provider would send it back to the
     * app's callback, for an existing account. Local Supabase cannot run a
     * real provider, so this path exists on the fake only.
     */
    issueOAuthCode(email: string): string {
      if (!findByEmail(email)) throw new Error(`no account for ${email}`)
      const code = randomUUID()
      oauthCodes.set(code, email)
      return code
    },

    /** Whether an account exists for this email (test inspection only). */
    hasAccount(email: string): boolean {
      return findByEmail(email) !== undefined
    },

    /** The code most recently "emailed" to this address. */
    lastCodeSentTo(email: string): string {
      const code = codes.get(key(email))
      if (!code) throw new Error(`no code was sent to ${email}`)
      return code
    },
  }
}

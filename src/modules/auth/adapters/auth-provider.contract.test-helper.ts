import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { AUTH_ERROR_MESSAGES, type AuthProvider } from '../ports/auth-provider'

/**
 * The behavior every `AuthProvider` implementation must share. It runs
 * against the in-memory fake (unit) and against the Supabase adapter on the
 * local stack (integration), so the fake used by handler tests cannot drift
 * from what Supabase actually does.
 *
 * Each case was written against the Supabase adapter first (it passes
 * there: that is the reference), then made to pass on the fake. So the RED
 * of each case was observed on the fake.
 *
 * Errors are compared by `code` and by message: both reach the browser,
 * so the message must be one of `AUTH_ERROR_MESSAGES`, never the
 * provider's own text.
 *
 * Kept small on purpose: the local Supabase applies its own per-IP rate
 * limits (`[auth.rate_limit]` in supabase/config.toml) and every test runs
 * from the same IP.
 */
export type ContractSubject = {
  /** A provider with its own, empty session. */
  newSession(): AuthProvider
  /**
   * A session in the middle of an OAuth sign-in: the browser state a
   * provider redirect comes back to (for Supabase, the PKCE verifier
   * cookie), so an exchange is decided by the server, not the client.
   */
  newOAuthSession(): Promise<AuthProvider>
  /** Setup only: a confirmed user that can sign in with this password. */
  seedUser(email: string, password: string): Promise<void>
  /** The 6-digit code most recently sent to `email`. */
  readOtp(email: string): Promise<string>
  /** Called once at the end with every email the suite used. */
  cleanup(emails: string[]): Promise<void>
  /** Whether an account exists for this email (checked out of band). */
  accountExists(email: string): Promise<boolean>
  /**
   * Setup only: a session signed in anonymously, as the browser does with
   * "Continue without an account" (not an AuthProvider call: that sign-in
   * never goes through the server).
   */
  newAnonymousSession(): Promise<AuthProvider>
}

const PASSWORD = 'contract-password-1'

export function authProviderContract(name: string, subject: ContractSubject) {
  describe(`AuthProvider contract (${name})`, () => {
    const emails: string[] = []
    const newEmail = (prefix: string) => {
      const email = `${prefix}-${randomUUID()}@contract.test`
      emails.push(email)
      return email
    }

    afterAll(() => subject.cleanup(emails))

    it('signs up with a password, then signs in with the same credentials', async () => {
      const email = newEmail('signup')

      const signUpSession = subject.newSession()
      const signedUp = await signUpSession.signUpWithPassword({
        email,
        password: PASSWORD,
        name: 'Contract',
      })
      const signedIn = await subject.newSession().signInWithPassword({ email, password: PASSWORD })

      expect(signedUp).toEqual({
        ok: true,
        value: { userId: expect.any(String), email, isAnonymous: false },
      })
      expect(signedIn).toEqual(signedUp)
      // Signed in right away. Holds while email confirmations are off
      // (supabase/config.toml); turning them on must fail this line.
      expect(await signUpSession.getCurrentIdentity()).toEqual(signedIn.ok && signedIn.value)
    })

    it('rejects a wrong password', async () => {
      const email = newEmail('wrong-password')
      await subject.seedUser(email, PASSWORD)

      const result = await subject
        .newSession()
        .signInWithPassword({ email, password: 'nope-nope-1' })

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'UNAUTHENTICATED',
          message: AUTH_ERROR_MESSAGES.invalidCredentials,
        }),
      })
    })

    it('rejects an email that has no account', async () => {
      const result = await subject
        .newSession()
        .signInWithPassword({ email: newEmail('unknown'), password: PASSWORD })

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'UNAUTHENTICATED',
          message: AUTH_ERROR_MESSAGES.invalidCredentials,
        }),
      })
    })

    it('refuses to sign up an email that already has an account', async () => {
      const email = newEmail('duplicate')
      await subject.seedUser(email, PASSWORD)

      const result = await subject
        .newSession()
        .signUpWithPassword({ email, password: PASSWORD, name: 'Again' })

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'EXTERNAL_SERVICE_ERROR',
          message: AUTH_ERROR_MESSAGES.signUpFailed,
        }),
      })
    })

    it('answers a sign-in code request for an unknown email like a known one, creating nothing', async () => {
      // Answering differently would tell anyone which emails have accounts.
      const email = newEmail('otp-unknown')

      const result = await subject.newSession().requestSignInOtp({ email })

      expect(result).toEqual({ ok: true, value: undefined })
      expect(await subject.accountExists(email)).toBe(false)
    })

    it('signs up with a code: the emailed code verifies and returns the new identity', async () => {
      const email = newEmail('otp-signup')
      const session = subject.newSession()

      expect(await session.requestSignUpOtp({ email, name: 'Contract' })).toEqual({
        ok: true,
        value: undefined,
      })
      const verified = await session.verifyOtp({ email, token: await subject.readOtp(email) })

      expect(verified).toEqual({
        ok: true,
        value: { userId: expect.any(String), email, isAnonymous: false },
      })
      // Verifying the code is what signs the browser in.
      expect(await session.getCurrentIdentity()).toEqual(verified.ok && verified.value)
    })

    it('signs in with a code: the emailed code returns the existing identity', async () => {
      const email = newEmail('otp-signin')
      await subject.seedUser(email, PASSWORD)
      const known = await subject.newSession().signInWithPassword({ email, password: PASSWORD })
      const session = subject.newSession()

      expect(await session.requestSignInOtp({ email })).toEqual({ ok: true, value: undefined })
      const verified = await session.verifyOtp({ email, token: await subject.readOtp(email) })

      expect(verified).toEqual(known)
      expect(await session.getCurrentIdentity()).toEqual(known.ok && known.value)
    })

    it('rejects a wrong code', async () => {
      const email = newEmail('otp-wrong')
      await subject.seedUser(email, PASSWORD)
      const session = subject.newSession()
      expect(await session.requestSignInOtp({ email })).toEqual({ ok: true, value: undefined })
      const sent = await subject.readOtp(email)
      const wrong = sent === '000000' ? '111111' : '000000'

      const result = await session.verifyOtp({ email, token: wrong })

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'UNAUTHENTICATED',
          message: AUTH_ERROR_MESSAGES.invalidCode,
        }),
      })
    })

    it('answers a code for an email with no account like a wrong code', async () => {
      const result = await subject
        .newSession()
        .verifyOtp({ email: newEmail('verify-unknown'), token: '123456' })

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'UNAUTHENTICATED',
          message: AUTH_ERROR_MESSAGES.invalidCode,
        }),
      })
    })

    // Only the rejection is contract-checked: the local Supabase has no
    // working OAuth provider, so the success path exists on the fake only.
    it('rejects an OAuth code it did not issue', async () => {
      const session = await subject.newOAuthSession()

      const result = await session.exchangeOAuthCode('not-a-real-code')

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'EXTERNAL_SERVICE_ERROR',
          message: AUTH_ERROR_MESSAGES.unavailable,
        }),
      })
    })

    it('tracks the current identity: none, then the signed-in user, then none after sign-out', async () => {
      const email = newEmail('session')
      await subject.seedUser(email, PASSWORD)
      const session = subject.newSession()

      expect(await session.getCurrentIdentity()).toBeNull()
      const signedIn = await session.signInWithPassword({ email, password: PASSWORD })
      if (!signedIn.ok) throw signedIn.error
      expect(await session.getCurrentIdentity()).toEqual(signedIn.value)
      expect(await session.signOut()).toEqual({ ok: true, value: undefined })
      expect(await session.getCurrentIdentity()).toBeNull()
    })

    it('treats emails as case-insensitive', async () => {
      const email = newEmail('case')
      const signedUp = await subject
        .newSession()
        .signUpWithPassword({ email: email.toUpperCase(), password: PASSWORD, name: 'Case' })

      const result = await subject.newSession().signInWithPassword({ email, password: PASSWORD })

      // Stored lowercased, and the same account either way.
      expect(signedUp).toEqual({
        ok: true,
        value: { userId: expect.any(String), email, isAnonymous: false },
      })
      expect(result).toEqual(signedUp)
    })

    it('turns an anonymous session into a permanent account with the same id', async () => {
      const email = newEmail('convert')
      const session = await subject.newAnonymousSession()
      const anonymous = await session.getCurrentIdentity()
      expect(anonymous).toEqual({ userId: expect.any(String), email: null, isAnonymous: true })

      const converted = await session.addEmailAndPassword({ email, password: PASSWORD })
      const signedIn = await subject.newSession().signInWithPassword({ email, password: PASSWORD })

      const permanent = { userId: anonymous?.userId, email, isAnonymous: false }
      // Right away, with no code: email confirmations are off (supabase/config.toml).
      expect(converted).toEqual({ ok: true, value: permanent })
      expect(await session.getCurrentIdentity()).toEqual(permanent)
      expect(signedIn).toEqual({ ok: true, value: permanent })
    })

    it('refuses an email another account has, and the session stays anonymous', async () => {
      const email = newEmail('convert-taken')
      await subject.seedUser(email, PASSWORD)
      const session = await subject.newAnonymousSession()

      const result = await session.addEmailAndPassword({ email, password: 'other-password-1' })

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'CONFLICT',
          message: AUTH_ERROR_MESSAGES.emailUnavailable,
        }),
      })
      expect(await session.getCurrentIdentity()).toMatchObject({ isAnonymous: true, email: null })
    })

    it('replaces the password of the signed-in account', async () => {
      const email = newEmail('replace-password')
      await subject.seedUser(email, PASSWORD)
      const session = subject.newSession()
      await session.signInWithPassword({ email, password: PASSWORD })

      const replaced = await session.replacePassword({ password: 'brand-new-password-1' })

      expect(replaced).toEqual({ ok: true, value: undefined })
      expect(
        (await subject.newSession().signInWithPassword({ email, password: PASSWORD })).ok,
      ).toBe(false)
      expect(
        (await subject.newSession().signInWithPassword({ email, password: 'brand-new-password-1' }))
          .ok,
      ).toBe(true)
    })

    it('names each signed-in session apart, and none once signed out', async () => {
      const email = newEmail('session-id')
      await subject.seedUser(email, PASSWORD)
      const elsewhere = subject.newSession()
      await elsewhere.signInWithPassword({ email, password: PASSWORD })
      const here = subject.newSession()
      await here.signInWithPassword({ email, password: PASSWORD })

      const id = await here.currentSessionId()

      expect(id).toEqual(expect.any(String))
      expect(await elsewhere.currentSessionId()).not.toBe(id)
      await here.signOut()
      expect(await here.currentSessionId()).toBeNull()
    })
  })
}

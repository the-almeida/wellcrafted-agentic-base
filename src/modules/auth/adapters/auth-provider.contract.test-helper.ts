import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import type { AuthProvider } from '../ports/auth-provider'

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
 * Errors are compared by `code` only, the part that reaches the client.
 * Messages are pinned separately once the adapter stops passing Supabase's
 * text through.
 *
 * Kept small on purpose: the local Supabase applies its own per-IP rate
 * limits (`[auth.rate_limit]` in supabase/config.toml) and every test runs
 * from the same IP.
 */
export type ContractSubject = {
  /** A provider with its own, empty session. */
  newSession(): AuthProvider
  /** Setup only: a confirmed user that can sign in with this password. */
  seedUser(email: string, password: string): Promise<void>
  /** The 6-digit code most recently sent to `email`. */
  readOtp(email: string): Promise<string>
  /** Called once at the end with every email the suite used. */
  cleanup(emails: string[]): Promise<void>
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

      expect(signedUp).toEqual({ ok: true, value: { userId: expect.any(String), email } })
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
        error: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      })
    })

    it('rejects an email that has no account', async () => {
      const result = await subject
        .newSession()
        .signInWithPassword({ email: newEmail('unknown'), password: PASSWORD })

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
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
        error: expect.objectContaining({ code: 'EXTERNAL_SERVICE_ERROR' }),
      })
    })

    it('refuses a sign-in code for an email that has no account', async () => {
      const result = await subject.newSession().requestSignInOtp({ email: newEmail('otp-unknown') })

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      })
    })

    it('signs up with a code: the emailed code verifies and returns the new identity', async () => {
      const email = newEmail('otp-signup')
      const session = subject.newSession()

      expect(await session.requestSignUpOtp({ email, name: 'Contract' })).toEqual({
        ok: true,
        value: undefined,
      })
      const verified = await session.verifyOtp({ email, token: await subject.readOtp(email) })

      expect(verified).toEqual({ ok: true, value: { userId: expect.any(String), email } })
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
        error: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
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
      expect(signedUp).toEqual({ ok: true, value: { userId: expect.any(String), email } })
      expect(result).toEqual(signedUp)
    })
  })
}

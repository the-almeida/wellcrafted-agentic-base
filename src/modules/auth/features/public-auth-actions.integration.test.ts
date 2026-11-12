import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { users } from '@/shared/db/schema/auth'
import { cleanupAuthUser, createTestUser } from '@/shared/db/test-helpers'
import type { UserId } from '@/shared/lib/ids'

import { createFakeAuth } from '../adapters/auth-provider.fake.test-helper'
import { userRepository } from '../adapters/user-repository.drizzle'
import type { AuthProvider } from '../ports/auth-provider'

import { requestSignInOtpWith } from './request-sign-in-otp/request-sign-in-otp.logic'
import { requestSignUpOtpWith } from './request-sign-up-otp/request-sign-up-otp.logic'
import { signInWith } from './sign-in/sign-in.logic'
import { signUpWith } from './sign-up/sign-up.logic'
import { completeOAuthSignInWith } from './oauth-callback/oauth-callback.logic'
import { verifyOtpWith } from './verify-otp/verify-otp.logic'

// The public auth actions (no session required) with the contract-checked
// fake in place of Supabase, the real in-memory rate limiter and the local
// database. Every test uses its own IP and email, so limiter buckets never
// leak between tests.

const PASSWORD = 'correct-horse-1'
const auth = createFakeAuth()
const uniqueIp = () => `test-ip-${randomUUID()}`
const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID()}@actions.test`

const createdUserIds: string[] = []
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await cleanupAuthUser(id)
})

function deps(ip = uniqueIp()): { authProvider: AuthProvider; ip: string } {
  return { authProvider: auth.newSession(), ip }
}

type Action = {
  name: string
  perEmail: number
  perIp: number
  call: (ip: string, email: string) => Promise<{ ok: boolean; error?: { code: string } }>
}

const ACTIONS: Action[] = [
  {
    name: 'sign-in',
    perEmail: 10,
    perIp: 30,
    call: (ip, email) => signInWith(deps(ip), { email, password: 'wrong-password-1' }),
  },
  {
    name: 'sign-up',
    perEmail: 5,
    perIp: 30,
    call: (ip, email) => signUpWith(deps(ip), { email, password: PASSWORD, name: 'Limit' }),
  },
  {
    name: 'request-sign-in-otp',
    perEmail: 5,
    perIp: 30,
    call: (ip, email) => requestSignInOtpWith(deps(ip), { email }),
  },
  {
    name: 'request-sign-up-otp',
    perEmail: 5,
    perIp: 30,
    call: (ip, email) => requestSignUpOtpWith(deps(ip), { email, name: 'Limit' }),
  },
  {
    name: 'verify-otp',
    perEmail: 10,
    perIp: 50,
    call: (ip, email) => verifyOtpWith(deps(ip), { email, token: '123456' }),
  },
]

const rateLimited = { ok: false, error: expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED' }) }

describe('public auth actions', () => {
  it('signs in a registered user and returns their profile', async () => {
    const seeded = await createTestUser({ prefix: 'sign-in' })
    createdUserIds.push(seeded.id)
    auth.addUser({ userId: seeded.id, email: seeded.email, password: PASSWORD })

    const result = await signInWith(deps(), { email: seeded.email, password: PASSWORD })

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ id: seeded.id, name: seeded.name, pendingDeletion: null }),
    })
  })

  it('treats a signed-in account without a profile row as a bug, not a user error', async () => {
    // The auth trigger creates the row in the same transaction as the
    // account, so a missing row is a broken invariant: it must reach the
    // error boundary (logs, Sentry), not be shown to the user.
    const email = uniqueEmail('no-profile')
    auth.addUser({ email, password: PASSWORD })

    await expect(signInWith(deps(), { email, password: PASSWORD })).rejects.toThrow(
      'has no public.users row',
    )
  })

  it('signs up and returns the new identity', async () => {
    const email = uniqueEmail('sign-up')

    const result = await signUpWith(deps(), { email, password: PASSWORD, name: 'New' })

    expect(result).toEqual({
      ok: true,
      value: { userId: expect.any(String), email, isAnonymous: false },
    })
  })

  describe('verifying a code records that the email is verified', () => {
    async function seededWithCode() {
      const seeded = await createTestUser({ prefix: 'verify' })
      createdUserIds.push(seeded.id)
      auth.addUser({ userId: seeded.id, email: seeded.email, password: PASSWORD })
      await requestSignInOtpWith(deps(), { email: seeded.email })
      return { ...seeded, code: auth.lastCodeSentTo(seeded.email) }
    }
    const verifiedAt = async (id: UserId) => (await userRepository.findById(id))?.emailVerifiedAt

    it('sets it on the right code, and a wrong code changes nothing', async () => {
      const user = await seededWithCode()
      const wrong = user.code === '000000' ? '111111' : '000000'

      const refused = await verifyOtpWith(deps(), { email: user.email, token: wrong })
      expect(refused).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      })
      expect(await verifiedAt(user.id)).toBeNull()

      const before = Date.now()
      const result = await verifyOtpWith(deps(), { email: user.email, token: user.code })

      expect(result.ok).toBe(true)
      expect((await verifiedAt(user.id))?.getTime()).toBeGreaterThanOrEqual(before - 1_000)
    })

    it("does not mark an email the person did not prove (the account's email changed)", async () => {
      const user = await seededWithCode()
      // The account's email is now another address; the code proves the old one.
      await db
        .update(users)
        .set({ email: uniqueEmail('changed') })
        .where(eq(users.id, user.id))

      const result = await verifyOtpWith(deps(), { email: user.email, token: user.code })

      expect(result.ok).toBe(true)
      expect(await verifiedAt(user.id)).toBeNull()
    })

    it('matches the proven email regardless of case', async () => {
      const user = await seededWithCode()
      await db.update(users).set({ email: user.email.toUpperCase() }).where(eq(users.id, user.id))

      const result = await verifyOtpWith(deps(), { email: user.email, token: user.code })

      expect(result.ok).toBe(true)
      expect(await verifiedAt(user.id)).toBeInstanceOf(Date)
    })

    it('keeps the first verification time on later verifications', async () => {
      const user = await seededWithCode()
      const first = new Date('2026-01-01T00:00:00Z')
      await db.update(users).set({ emailVerifiedAt: first }).where(eq(users.id, user.id))

      const result = await verifyOtpWith(deps(), { email: user.email, token: user.code })

      expect(result.ok).toBe(true)
      expect(await verifiedAt(user.id)).toEqual(first)
    })
  })

  it('completes an OAuth sign-in and records the email as verified by the provider', async () => {
    const seeded = await createTestUser({ prefix: 'oauth' })
    createdUserIds.push(seeded.id)
    auth.addUser({ userId: seeded.id, email: seeded.email, password: PASSWORD })
    const before = Date.now()

    const result = await completeOAuthSignInWith(deps(), auth.issueOAuthCode(seeded.email))

    expect(result).toEqual({
      ok: true,
      value: { userId: seeded.id, email: seeded.email, isAnonymous: false },
    })
    const user = await userRepository.findById(seeded.id)
    expect(user?.emailVerifiedAt?.getTime()).toBeGreaterThanOrEqual(before - 1_000)
  })

  it("does not verify the account's email through OAuth when the provider vouched for another", async () => {
    const seeded = await createTestUser({ prefix: 'oauth-changed' })
    createdUserIds.push(seeded.id)
    auth.addUser({ userId: seeded.id, email: seeded.email, password: PASSWORD })
    await db
      .update(users)
      .set({ email: uniqueEmail('changed') })
      .where(eq(users.id, seeded.id))

    const result = await completeOAuthSignInWith(deps(), auth.issueOAuthCode(seeded.email))

    expect(result.ok).toBe(true)
    expect((await userRepository.findById(seeded.id))?.emailVerifiedAt).toBeNull()
  })

  it('sends a sign-up code to the email', async () => {
    const email = uniqueEmail('otp-sign-up')

    const result = await requestSignUpOtpWith(deps(), { email, name: 'New' })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(auth.lastCodeSentTo(email)).toMatch(/^\d{6}$/)
  })

  it('answers a sign-in code request for an unknown email like a known one, sending nothing', async () => {
    const email = uniqueEmail('unknown')

    const result = await requestSignInOtpWith(deps(), { email })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(() => auth.lastCodeSentTo(email)).toThrow('no code was sent')
  })

  it.each([
    {
      name: 'sign-in with a wrong password',
      run: async () => {
        const email = uniqueEmail('wrong')
        auth.addUser({ email, password: PASSWORD })
        return signInWith(deps(), { email, password: 'wrong-password-1' })
      },
      code: 'UNAUTHENTICATED',
    },
    {
      name: 'sign-up of a registered email',
      run: async () => {
        const email = uniqueEmail('taken')
        auth.addUser({ email, password: PASSWORD })
        return signUpWith(deps(), { email, password: PASSWORD, name: 'Again' })
      },
      code: 'EXTERNAL_SERVICE_ERROR',
    },
    {
      name: 'verify with a wrong code',
      run: async () => {
        const email = uniqueEmail('bad-code')
        auth.addUser({ email, password: PASSWORD })
        await requestSignInOtpWith(deps(), { email })
        const wrong = auth.lastCodeSentTo(email) === '000000' ? '111111' : '000000'
        return verifyOtpWith(deps(), { email, token: wrong })
      },
      code: 'UNAUTHENTICATED',
    },
  ])('passes the provider error through: $name', async ({ run, code }) => {
    expect(await run()).toEqual({ ok: false, error: expect.objectContaining({ code }) })
  })

  it.each(ACTIONS)('$name: limits calls per email', async ({ perEmail, call }) => {
    const email = uniqueEmail('per-email')

    for (let n = 1; n <= perEmail; n++) {
      // A fresh IP each time, so only the email bucket fills up.
      expect(await call(uniqueIp(), email), `call ${n}`).not.toEqual(rateLimited)
    }

    expect(await call(uniqueIp(), email)).toEqual(rateLimited)
  })

  it.each(ACTIONS)('$name: limits calls per IP across emails', async ({ perIp, call }) => {
    const ip = uniqueIp()

    for (let n = 1; n <= perIp; n++) {
      expect(await call(ip, uniqueEmail('per-ip')), `call ${n}`).not.toEqual(rateLimited)
    }

    expect(await call(ip, uniqueEmail('per-ip'))).toEqual(rateLimited)
  })

  it.each(ACTIONS)(
    "$name: calls refused by an exhausted IP do not use up the email's budget",
    async ({ perEmail, perIp, call }) => {
      // One attacker IP spends its own budget, then keeps hammering a
      // victim's email from that IP. The victim, from their own IP, must
      // still get through: otherwise anyone can lock any email out.
      const attackerIp = uniqueIp()
      for (let n = 0; n < perIp; n++) await call(attackerIp, uniqueEmail('filler'))
      const victim = uniqueEmail('victim')
      for (let n = 0; n < perEmail; n++) {
        expect(await call(attackerIp, victim)).toEqual(rateLimited)
      }

      expect(await call(uniqueIp(), victim)).not.toEqual(rateLimited)
    },
  )

  it('rejects the 11th sign-in for one email even with the right password', async () => {
    const email = uniqueEmail('brute')
    auth.addUser({ email, password: PASSWORD })
    for (let n = 0; n < 10; n++) {
      await signInWith(deps(), { email, password: 'wrong-password-1' })
    }

    expect(await signInWith(deps(), { email, password: PASSWORD })).toEqual(rateLimited)
  })
})

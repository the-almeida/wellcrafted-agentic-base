import { describe, expect, it } from 'vitest'

import { UserIdSchema } from '@/shared/lib/ids'

import { createFakeAuth } from '../../adapters/auth-provider.fake.test-helper'
import type { User } from '../../domain/user'

import { keepAccountWith } from './keep-account.logic'

// The account as requireUser hands it over; only id and isAnonymous matter here.
function userFor(id: string, isAnonymous: boolean): User {
  return {
    id: UserIdSchema.parse(id),
    isAnonymous,
    email: isAnonymous ? null : 'someone@example.test',
    name: null,
    profile: { nickname: 'Wolf', discriminator: 42 },
    role: 'user',
    pendingDeletion: null,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('keepAccountWith', () => {
  it('adds an email and password to an anonymous account, keeping its id', async () => {
    const auth = createFakeAuth()
    const session = auth.newAnonymousSession()
    const identity = await session.getCurrentIdentity()
    if (!identity) throw new Error('no anonymous session')

    const result = await keepAccountWith(
      { authProvider: session },
      userFor(identity.userId, true),
      { email: 'kept@example.test', password: 'kept-password-1' },
    )

    expect(result).toEqual({
      ok: true,
      value: { userId: identity.userId, email: 'kept@example.test', isAnonymous: false },
    })
    expect(auth.hasAccount('kept@example.test')).toBe(true)
  })

  it('refuses an account that is already permanent, without touching it', async () => {
    const auth = createFakeAuth()
    const identity = auth.addUser({ email: 'someone@example.test', password: 'old-password-1' })
    const session = auth.newSession()
    await session.signInWithPassword({ email: 'someone@example.test', password: 'old-password-1' })

    const result = await keepAccountWith(
      { authProvider: session },
      userFor(identity.userId, false),
      {
        email: 'other@example.test',
        password: 'new-password-1',
      },
    )

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'CONFLICT' }) })
    expect(auth.hasAccount('other@example.test')).toBe(false)
    expect(
      (
        await auth
          .newSession()
          .signInWithPassword({ email: 'someone@example.test', password: 'old-password-1' })
      ).ok,
    ).toBe(true)
  })
})

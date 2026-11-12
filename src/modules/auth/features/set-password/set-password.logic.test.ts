import { describe, expect, it } from 'vitest'

import { createFakeAuth } from '../../adapters/auth-provider.fake.test-helper'

import { setPasswordWith } from './set-password.logic'

describe('setPasswordWith', () => {
  it('sets the password the person signs in with from then on', async () => {
    const auth = createFakeAuth()
    auth.addUser({ email: 'pick@example.test', password: 'random-replaced-1' })
    const session = auth.newSession()
    await session.signInWithPassword({ email: 'pick@example.test', password: 'random-replaced-1' })

    const result = await setPasswordWith({ authProvider: session }, { password: 'my-choice-123' })

    expect(result).toEqual({ ok: true, value: undefined })
    const signedIn = await auth
      .newSession()
      .signInWithPassword({ email: 'pick@example.test', password: 'my-choice-123' })
    expect(signedIn.ok).toBe(true)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { authProviderContract } from './auth-provider.contract.test-helper'
import { createFakeAuth } from './auth-provider.fake.test-helper'

// One fake "service" shared by every session, like one Supabase project.
const auth = createFakeAuth()

authProviderContract('in-memory fake', {
  newSession: () => auth.newSession(),
  newOAuthSession: async () => auth.newSession(),
  seedUser: async (email, password) => {
    auth.addUser({ email, password })
  },
  readOtp: async (email) => auth.lastCodeSentTo(email),
  cleanup: async () => {},
  accountExists: async (email) => auth.hasAccount(email),
})

describe('createFakeAuth outside tests', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refuses to run in production, where it would sign anyone in', () => {
    vi.stubEnv('NODE_ENV', 'production')

    expect(() => createFakeAuth()).toThrow('fake auth provider')
  })
})

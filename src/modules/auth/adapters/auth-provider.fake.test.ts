import { authProviderContract } from './auth-provider.contract.test-helper'
import { createFakeAuth } from './auth-provider.fake.test-helper'

// One fake "service" shared by every session, like one Supabase project.
const auth = createFakeAuth()

authProviderContract('in-memory fake', {
  newSession: () => auth.newSession(),
  seedUser: async (email, password) => {
    auth.addUser({ email, password })
  },
  readOtp: async (email) => auth.lastCodeSentTo(email),
  cleanup: async () => {},
})

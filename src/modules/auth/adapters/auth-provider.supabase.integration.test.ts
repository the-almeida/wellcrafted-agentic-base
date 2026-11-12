import { createServerClient } from '@supabase/ssr'

import {
  cleanupAuthUser,
  cleanupMailpitFor,
  getAdminSupabase,
  pollMailpitForOtp,
} from '@/shared/db/test-helpers'
import { env } from '@/shared/lib/env'

import { authProviderContract } from './auth-provider.contract.test-helper'
import { createSupabaseAuthProvider } from './auth-provider.supabase'

// The adapter against the local Supabase stack. Each session is one browser:
// an in-memory cookie jar. Like the app (a new server client per call, over
// the request's cookies), every call builds a fresh client over the jar, so
// anything that carries over between calls has to go through the cookies.
function newSession() {
  const jar = new Map<string, string>()
  const newClient = () =>
    createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const { name, value } of cookies) {
            if (value) jar.set(name, value)
            else jar.delete(name)
          }
        },
      },
    })
  return createSupabaseAuthProvider(async () => newClient())
}

authProviderContract('Supabase, local stack', {
  newSession,
  async seedUser(email, password) {
    const { error } = await getAdminSupabase().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'Contract seed' },
    })
    if (error) throw error
  },
  readOtp: pollMailpitForOtp,
  async cleanup(emails) {
    const wanted = new Set(emails.map((email) => email.toLowerCase()))
    for (let page = 1; ; page++) {
      const { data, error } = await getAdminSupabase().auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      for (const user of data.users) {
        if (user.email && wanted.has(user.email.toLowerCase())) await cleanupAuthUser(user.id)
      }
      if (data.users.length < 200) break
    }
    for (const email of wanted) await cleanupMailpitFor(email)
  },
})

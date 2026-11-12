import { createServerClient } from '@supabase/ssr'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cleanupAuthUser,
  cleanupMailpitFor,
  getAdminSupabase,
  pollMailpitForOtp,
} from '@/shared/db/test-helpers'
import { env } from '@/shared/lib/env'
import { logger } from '@/shared/observability/logger'

import { AUTH_ERROR_MESSAGES } from '../ports/auth-provider'

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
  async accountExists(email) {
    const wanted = email.toLowerCase()
    for (let page = 1; ; page++) {
      const { data, error } = await getAdminSupabase().auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      if (data.users.some((user) => user.email?.toLowerCase() === wanted)) return true
      if (data.users.length < 200) return false
    }
  },
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

describe('Supabase adapter when Supabase cannot be reached', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Nothing listens on this port, so every call fails at the network level.
  const down = createSupabaseAuthProvider(async () =>
    createServerClient('http://127.0.0.1:59999', env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: { getAll: () => [], setAll: () => {} },
    }),
  )
  const email = 'down@contract.test'

  it.each([
    ['signInWithPassword', () => down.signInWithPassword({ email, password: 'x-password-1' })],
    [
      'signUpWithPassword',
      () => down.signUpWithPassword({ email, password: 'x-password-1', name: 'X' }),
    ],
    ['requestSignUpOtp', () => down.requestSignUpOtp({ email, name: 'X' })],
    ['verifyOtp', () => down.verifyOtp({ email, token: '123456' })],
  ])('%s answers with the generic unavailable error', async (_name, call) => {
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined)

    expect(await call()).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'EXTERNAL_SERVICE_ERROR',
        message: AUTH_ERROR_MESSAGES.unavailable,
      }),
    })
    // Went through the mapper's outage branch (no HTTP response: status 0).
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'supabase', status: 0 }),
      expect.any(String),
    )
  })

  it('treats the session as signed out', async () => {
    expect(await down.getCurrentIdentity()).toBeNull()
  })
})

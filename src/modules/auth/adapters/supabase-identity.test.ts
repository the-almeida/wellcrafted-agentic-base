import { afterEach, describe, expect, it, vi } from 'vitest'

import { logger } from '@/shared/observability/logger'

import { AUTH_ERROR_MESSAGES } from '../ports/auth-provider'

import { identityFromSupabaseUser } from './supabase-identity'

afterEach(() => {
  vi.restoreAllMocks()
})

const id = '00000000-0000-4000-8000-000000000001'

describe('identityFromSupabaseUser', () => {
  it('returns the identity of a user with an email and a uuid id', () => {
    expect(identityFromSupabaseUser({ id, email: 'someone@example.test' })).toEqual({
      ok: true,
      value: { userId: id, email: 'someone@example.test', isAnonymous: false },
    })
  })

  it('returns the identity of an anonymous user, who has no email', () => {
    expect(identityFromSupabaseUser({ id, email: null, is_anonymous: true })).toEqual({
      ok: true,
      value: { userId: id, email: null, isAnonymous: true },
    })
  })

  it.each([
    ['no email', { id, email: null }],
    ['no email and is not anonymous', { id, email: '', is_anonymous: false }],
    ['a non-uuid id', { id: 'not-a-uuid', email: 'someone@example.test' }],
  ])('answers a user with %s like a provider failure, logging no email', (_label, user) => {
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined)

    expect(identityFromSupabaseUser(user)).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'EXTERNAL_SERVICE_ERROR',
        message: AUTH_ERROR_MESSAGES.unavailable,
      }),
    })
    expect(logged).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(logged.mock.calls)).not.toContain('someone@example.test')
  })
})

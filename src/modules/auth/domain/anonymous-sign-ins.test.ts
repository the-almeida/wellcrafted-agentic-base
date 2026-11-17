import { describe, expect, it } from 'vitest'

import { anonymousSignInsSetup, findAnonymousSignInMismatch } from './anonymous-sign-ins'

describe('anonymousSignInsSetup', () => {
  it.each([
    ['unset', {}],
    ['blank', { ANONYMOUS_SIGN_INS_ENABLED: '  ' }],
    ['"true"', { ANONYMOUS_SIGN_INS_ENABLED: 'true' }],
  ])('is on when the variable is %s (on by default)', (_label, env) => {
    expect(anonymousSignInsSetup(env)).toEqual({ status: 'valid', enabled: true })
  })

  it('is off with "false"', () => {
    expect(anonymousSignInsSetup({ ANONYMOUS_SIGN_INS_ENABLED: 'false' })).toEqual({
      status: 'valid',
      enabled: false,
    })
  })

  it.each(['no', '0', 'False', 'off'])('reports %s as a problem instead of guessing', (value) => {
    expect(anonymousSignInsSetup({ ANONYMOUS_SIGN_INS_ENABLED: value })).toEqual({
      status: 'invalid',
      problem: expect.stringContaining('ANONYMOUS_SIGN_INS_ENABLED must be "true" or "false"'),
    })
  })
})

describe('findAnonymousSignInMismatch', () => {
  it('finds nothing when both agree', () => {
    expect(findAnonymousSignInMismatch(true, { anonymous_users: true })).toBeNull()
    expect(findAnonymousSignInMismatch(false, { anonymous_users: false })).toBeNull()
    expect(findAnonymousSignInMismatch(false, {})).toBeNull()
  })

  it('reports anonymous mode on in the app but off in Supabase, with both ways out', () => {
    const problem = findAnonymousSignInMismatch(true, { anonymous_users: false })

    expect(problem).toContain('Anonymous sign-ins are disabled in Supabase')
    expect(problem).toContain('ANONYMOUS_SIGN_INS_ENABLED=false')
  })

  it('reports anonymous sign-ins on in Supabase while the app turned them off', () => {
    // Anyone with the public anon key could still sign in anonymously.
    expect(findAnonymousSignInMismatch(false, { anonymous_users: true })).toContain(
      'Anonymous sign-ins are enabled in Supabase, but ANONYMOUS_SIGN_INS_ENABLED=false',
    )
  })
})

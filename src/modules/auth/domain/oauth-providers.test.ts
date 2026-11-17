import { describe, expect, it } from 'vitest'

import {
  activeOAuthProviders,
  facebookDataDeletionSetup,
  findProviderMismatches,
} from './oauth-providers'

describe('activeOAuthProviders', () => {
  it('is empty when no provider has a client id', () => {
    expect(activeOAuthProviders({})).toEqual([])
  })

  it('lists only the providers whose client id is set', () => {
    expect(activeOAuthProviders({ GOOGLE_OAUTH_CLIENT_ID: 'google-id' })).toEqual(['google'])
    expect(activeOAuthProviders({ FACEBOOK_OAUTH_CLIENT_ID: 'facebook-id' })).toEqual(['facebook'])
  })

  it('lists every provider whose client id is set, in a stable order', () => {
    expect(
      activeOAuthProviders({
        FACEBOOK_OAUTH_CLIENT_ID: 'facebook-id',
        GOOGLE_OAUTH_CLIENT_ID: 'google-id',
      }),
    ).toEqual(['google', 'facebook'])
  })

  it('treats a blank client id as not set', () => {
    // The build check reads raw process.env, where `.env.example` leaves these blank.
    expect(
      activeOAuthProviders({ GOOGLE_OAUTH_CLIENT_ID: '  ', FACEBOOK_OAUTH_CLIENT_ID: '' }),
    ).toEqual([])
  })
})

describe('findProviderMismatches', () => {
  // Shape of `external` in Supabase Auth's public GET /auth/v1/settings.
  const supabaseExternal = (enabled: Record<string, boolean>) => ({
    email: true,
    phone: false,
    anonymous_users: false,
    google: false,
    facebook: false,
    github: false,
    apple: false,
    ...enabled,
  })

  it('reports nothing when the app and Supabase agree', () => {
    expect(findProviderMismatches([], supabaseExternal({}))).toEqual([])
    expect(
      findProviderMismatches(
        ['google', 'facebook'],
        supabaseExternal({ google: true, facebook: true }),
      ),
    ).toEqual([])
  })

  it('reports a provider enabled in Supabase that the app does not offer', () => {
    expect(findProviderMismatches([], supabaseExternal({ google: true }))).toEqual([
      'Google is enabled in Supabase, but GOOGLE_OAUTH_CLIENT_ID is not set in the app. Set it, or disable Google in Supabase.',
    ])
  })

  it('reports a provider the app offers that Supabase has disabled', () => {
    expect(findProviderMismatches(['facebook'], supabaseExternal({}))).toEqual([
      'FACEBOOK_OAUTH_CLIENT_ID is set in the app, but Facebook is disabled in Supabase. Enable it in Supabase, or unset the variable.',
    ])
  })

  it('reports any other OAuth provider enabled in Supabase, since the app cannot account for it', () => {
    expect(findProviderMismatches([], supabaseExternal({ github: true, apple: true }))).toEqual([
      'apple is enabled in Supabase, but the app does not support it. Disable it in Supabase.',
      'github is enabled in Supabase, but the app does not support it. Disable it in Supabase.',
    ])
  })

  it('ignores email, phone and anonymous sign-ins, which are not OAuth providers', () => {
    expect(
      findProviderMismatches(
        [],
        supabaseExternal({ email: true, phone: true, anonymous_users: true }),
      ),
    ).toEqual([])
  })
})

describe('facebookDataDeletionSetup', () => {
  it.each([
    ['nothing set', {}],
    ['both blank', { FACEBOOK_OAUTH_CLIENT_ID: '  ', FACEBOOK_OAUTH_CLIENT_SECRET: ' ' }],
  ])('is unused with neither a Facebook client id nor a secret (%s)', (_label, env) => {
    expect(facebookDataDeletionSetup(env)).toEqual({ status: 'unused' })
  })

  it('stays ready with only the secret, so Facebook users keep their deletion callback', () => {
    // Removing the client id hides the button, but people who signed in with
    // Facebook still exist and Facebook still calls the callback for them.
    expect(facebookDataDeletionSetup({ FACEBOOK_OAUTH_CLIENT_SECRET: 'app-secret' })).toEqual({
      status: 'ready',
      appSecret: 'app-secret',
    })
  })

  it.each([
    ['missing', {}],
    ['empty', { FACEBOOK_OAUTH_CLIENT_SECRET: '' }],
    ['blank', { FACEBOOK_OAUTH_CLIENT_SECRET: '   ' }],
  ])('reports the missing secret when Facebook is active and the secret is %s', (_l, extra) => {
    const setup = facebookDataDeletionSetup({ FACEBOOK_OAUTH_CLIENT_ID: 'facebook-id', ...extra })

    expect(setup).toEqual({ status: 'missing-secret', problem: expect.any(String) })
    const { problem } = setup as { problem: string }
    expect(problem).toContain('FACEBOOK_OAUTH_CLIENT_ID')
    expect(problem).toContain('FACEBOOK_OAUTH_CLIENT_SECRET')
    expect(problem).toContain('data deletion callback')
  })

  it('is ready with the app secret when Facebook is active and the secret is set', () => {
    expect(
      facebookDataDeletionSetup({
        FACEBOOK_OAUTH_CLIENT_ID: 'facebook-id',
        FACEBOOK_OAUTH_CLIENT_SECRET: 'app-secret',
      }),
    ).toEqual({ status: 'ready', appSecret: 'app-secret' })
  })
})

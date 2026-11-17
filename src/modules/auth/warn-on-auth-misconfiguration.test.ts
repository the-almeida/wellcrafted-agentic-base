import { afterEach, describe, expect, it, vi } from 'vitest'

// The env module validates process.env once, at import, so each case loads
// fresh copies with its own Facebook variables.
async function load(facebook: { clientId?: string; secret?: string }) {
  vi.resetModules()
  vi.stubEnv('FACEBOOK_OAUTH_CLIENT_ID', facebook.clientId ?? '')
  vi.stubEnv('FACEBOOK_OAUTH_CLIENT_SECRET', facebook.secret ?? '')
  const { warnOnAuthMisconfiguration } = await import('./warn-on-auth-misconfiguration')
  const { logger } = await import('@/shared/observability/logger')
  const warned = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
  return { warnOnAuthMisconfiguration, warned }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('warnOnAuthMisconfiguration', () => {
  it('warns once when Facebook is active without the app secret', async () => {
    const { warnOnAuthMisconfiguration, warned } = await load({ clientId: 'facebook-id-value' })

    warnOnAuthMisconfiguration()

    expect(warned).toHaveBeenCalledTimes(1)
    const message = String(warned.mock.calls[0]?.[0])
    expect(message).toContain('FACEBOOK_OAUTH_CLIENT_SECRET')
    expect(message).toContain('data deletion callback')
    expect(message).not.toContain('facebook-id-value')
  })

  it.each([
    ['Facebook is not used', {}],
    ['Facebook sign-in is off but the callback secret is kept', { secret: 'app-secret' }],
    ['Facebook is fully configured', { clientId: 'facebook-id', secret: 'app-secret' }],
  ])('stays quiet when %s', async (_label, facebook) => {
    const { warnOnAuthMisconfiguration, warned } = await load(facebook)

    warnOnAuthMisconfiguration()

    expect(warned).not.toHaveBeenCalled()
  })
})

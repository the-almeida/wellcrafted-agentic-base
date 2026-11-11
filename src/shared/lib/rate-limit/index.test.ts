import { afterEach, describe, expect, it, vi } from 'vitest'

// What index.ts adds on top of the limiters (whose behavior is the contract in
// contract.test-helper.ts): picking the in-memory backend when no KV variables
// are set, and saying so once. The Redis branch is covered in
// redis.integration.test.ts, which needs the local Redis.
describe('rateLimit (public entry point, no KV variables)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  async function importFresh() {
    vi.resetModules()
    // Production is where the notice matters, and where it used to fire at import.
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KV_REST_API_URL', '')
    vi.stubEnv('KV_REST_API_TOKEN', '')
    const { logger } = await import('@/shared/observability/logger')
    const warned = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const consoleWarned = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const rateLimitModule = await import('./index')
    return { rateLimit: rateLimitModule.rateLimit, warned, consoleWarned }
  }

  it('counts in memory: the call after max is rejected', async () => {
    const { rateLimit } = await importFresh()
    const key = `entry-memory-${Math.random()}`
    const config = { windowMs: 60_000, max: 2 }

    expect((await rateLimit(key, config)).ok).toBe(true)
    expect((await rateLimit(key, config)).ok).toBe(true)
    const rejected = await rateLimit(key, config)

    if (rejected.ok) throw new Error('call max+1 should be rejected')
    expect(rejected.error.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('logs nothing when the module is imported', async () => {
    const { warned, consoleWarned } = await importFresh()

    expect(consoleWarned).not.toHaveBeenCalled()
    expect(warned).not.toHaveBeenCalled()
  })

  it('warns once, on first use, that rate limiting is in memory', async () => {
    const { rateLimit, warned, consoleWarned } = await importFresh()

    await rateLimit(`notice-${Math.random()}`, { windowMs: 60_000, max: 5 })
    await rateLimit(`notice-${Math.random()}`, { windowMs: 60_000, max: 5 })

    expect(warned).toHaveBeenCalledTimes(1)
    expect(warned).toHaveBeenCalledWith(
      '[rate-limit] in-memory rate limiting active; not safe for multi-instance production',
    )
    expect(consoleWarned).not.toHaveBeenCalled()
  })
})

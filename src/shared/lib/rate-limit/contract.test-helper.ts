import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import type { RateLimiter } from './limiter'

/**
 * The behavior every rate-limit backend must share. Each backend's test
 * file calls this with a factory, so memory and Redis are held to the same
 * specification. Uses real time with short windows: Redis TTLs cannot be
 * driven by fake timers.
 */
export function describeRateLimitContract(backend: string, makeLimiter: () => RateLimiter): void {
  describe(`rate limit contract (${backend})`, () => {
    const freshKey = (label: string) => `contract:${label}:${randomUUID()}`

    it('lets the first call on a fresh key through', async () => {
      const limit = makeLimiter()

      const result = await limit(freshKey('fresh'), { windowMs: 1_000, max: 3 })

      expect(result).toEqual({ ok: true, value: undefined })
    })

    it('lets max calls through inside the window and rejects the next one with its key', async () => {
      const limit = makeLimiter()
      const key = freshKey('overlimit')
      const config = { windowMs: 5_000, max: 3 }

      for (let call = 1; call <= config.max; call++) {
        expect((await limit(key, config)).ok, `call ${call}`).toBe(true)
      }
      const rejected = await limit(key, config)

      if (rejected.ok) throw new Error('call max+1 should be rejected')
      expect(rejected.error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(rejected.error.key).toBe(key)
    })

    it('lets calls through again once the window has elapsed', async () => {
      const limit = makeLimiter()
      const key = freshKey('reset')
      const config = { windowMs: 300, max: 1 }

      expect((await limit(key, config)).ok).toBe(true)
      expect((await limit(key, config)).ok).toBe(false)
      // @wc-test-auditor-allow: sleep-band-aid — Redis TTLs run on the server clock; fake timers cannot advance them
      await sleep(config.windowMs + 150)

      expect((await limit(key, config)).ok).toBe(true)
    })

    it('counts each key separately', async () => {
      const limit = makeLimiter()
      const config = { windowMs: 5_000, max: 1 }
      const exhausted = freshKey('iso-a')

      await limit(exhausted, config)
      expect((await limit(exhausted, config)).ok).toBe(false)

      expect((await limit(freshKey('iso-b'), config)).ok).toBe(true)
    })

    it('does not extend the window when rejected calls keep arriving', async () => {
      const limit = makeLimiter()
      const key = freshKey('hammer')
      const config = { windowMs: 1_000, max: 1 }

      const windowOpened = Date.now()
      expect((await limit(key, config)).ok).toBe(true)
      // Rejections keep arriving through the first half of the window. If a
      // rejection restarted the window, it would now end near 1.5 windows,
      // so a probe at window + 200ms tells the two apart despite latency.
      while (Date.now() - windowOpened < config.windowMs / 2) {
        expect((await limit(key, config)).ok).toBe(false)
        await sleep(50)
      }
      // @wc-test-auditor-allow: sleep-band-aid — Redis TTLs run on the server clock; fake timers cannot advance them
      await sleep(config.windowMs + 200 - (Date.now() - windowOpened))

      expect((await limit(key, config)).ok).toBe(true)
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
}

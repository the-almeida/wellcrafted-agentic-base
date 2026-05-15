import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rateLimit } from './index'

describe('rateLimit (in-memory backend)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns ok for the first call against a fresh key', async () => {
    const result = await rateLimit(`test-fresh-${Math.random()}`, { windowMs: 60_000, max: 3 })
    expect(result.ok).toBe(true)
  })

  it('returns err with RateLimitExceededError on the (max+1)-th call within the window', async () => {
    const key = `test-overlimit-${Math.random()}`
    const config = { windowMs: 60_000, max: 3 }

    for (let i = 0; i < config.max; i++) {
      const ok = await rateLimit(key, config)
      expect(ok.ok, `call ${i + 1} should be ok`).toBe(true)
    }

    const exceeded = await rateLimit(key, config)
    expect(exceeded.ok).toBe(false)
    if (!exceeded.ok) {
      expect(exceeded.error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(exceeded.error.key).toBe(key)
    }
  })

  it('resets the counter after the window elapses', async () => {
    const key = `test-reset-${Math.random()}`
    const config = { windowMs: 60_000, max: 2 }

    await rateLimit(key, config)
    await rateLimit(key, config)
    const exceeded = await rateLimit(key, config)
    expect(exceeded.ok).toBe(false)

    vi.advanceTimersByTime(config.windowMs + 1)

    const afterReset = await rateLimit(key, config)
    expect(afterReset.ok).toBe(true)
  })

  it('keeps counters per key — one key over limit does not affect another', async () => {
    const config = { windowMs: 60_000, max: 1 }
    const keyA = `test-iso-a-${Math.random()}`
    const keyB = `test-iso-b-${Math.random()}`

    await rateLimit(keyA, config)
    const aExceeded = await rateLimit(keyA, config)
    expect(aExceeded.ok).toBe(false)

    const bFresh = await rateLimit(keyB, config)
    expect(bFresh.ok).toBe(true)
  })

  it('continues to return err while over limit (no implicit reset on rejection)', async () => {
    const key = `test-stays-locked-${Math.random()}`
    const config = { windowMs: 60_000, max: 1 }

    await rateLimit(key, config)
    const first = await rateLimit(key, config)
    expect(first.ok).toBe(false)

    // A few more rejections within the window should all stay err.
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(5_000)
      const subsequent = await rateLimit(key, config)
      expect(subsequent.ok).toBe(false)
    }
  })
})

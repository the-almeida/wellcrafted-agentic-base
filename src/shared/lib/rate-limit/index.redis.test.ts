import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fake of the external Redis client (the port boundary). Each direct
// command and each `multi().exec()` is one HTTP round trip to Upstash;
// `failRoundTrip` makes exactly one of them fail, the way a dropped
// connection would.
type Entry = { value: number; expiresAt: number | null }

const fake = {
  store: new Map<string, Entry>(),
  roundTrips: 0,
  failRoundTrip: null as number | null,
  reset() {
    this.store.clear()
    this.roundTrips = 0
    this.failRoundTrip = null
  },
  roundTrip() {
    this.roundTrips += 1
    if (this.roundTrips === this.failRoundTrip) throw new Error('fetch failed')
  },
  incr(key: string) {
    const entry = this.store.get(key) ?? { value: 0, expiresAt: null }
    entry.value += 1
    this.store.set(key, entry)
    return entry.value
  },
  pexpire(key: string, ms: number, option?: string) {
    const entry = this.store.get(key)
    if (!entry) return 0
    if (option?.toUpperCase() === 'NX' && entry.expiresAt !== null) return 0
    entry.expiresAt = Date.now() + ms
    return 1
  },
}

vi.mock('@upstash/redis', () => ({
  Redis: class {
    async incr(key: string) {
      fake.roundTrip()
      return fake.incr(key)
    }
    async pexpire(key: string, ms: number, option?: string) {
      fake.roundTrip()
      return fake.pexpire(key, ms, option)
    }
    multi() {
      const queued: Array<() => unknown> = []
      const tx = {
        incr(key: string) {
          queued.push(() => fake.incr(key))
          return tx
        },
        pexpire(key: string, ms: number, option?: string) {
          queued.push(() => fake.pexpire(key, ms, option))
          return tx
        },
        async exec() {
          fake.roundTrip()
          return queued.map((run) => run())
        },
      }
      return tx
    }
  },
}))

async function loadRateLimit() {
  vi.resetModules()
  vi.stubEnv('KV_REST_API_URL', 'https://fake-redis.example.com')
  vi.stubEnv('KV_REST_API_TOKEN', 'fake-token')
  return import('./index')
}

describe('rateLimit (Redis backend)', () => {
  beforeEach(() => fake.reset())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('never leaves a counter without an expiry, whichever round trip fails', async () => {
    const { rateLimit } = await loadRateLimit()
    const key = 'login:email:alice@example.com'
    const config = { windowMs: 60_000, max: 5 }

    // Clean run: proves the Redis path wrote the counter with an expiry,
    // and counts how many round trips one call makes.
    await expect(rateLimit(key, config)).resolves.toMatchObject({ ok: true })
    expect(fake.store.get(`rl:${key}`)).toMatchObject({ value: 1, expiresAt: expect.any(Number) })
    const roundTripsPerCall = fake.roundTrips

    for (let failing = 1; failing <= roundTripsPerCall; failing++) {
      fake.reset()
      fake.failRoundTrip = failing

      await expect(rateLimit(key, config)).rejects.toThrow('fetch failed')

      const keysWithoutExpiry = [...fake.store].filter(([, e]) => e.expiresAt === null)
      expect(keysWithoutExpiry, `round trip ${failing} failed`).toEqual([])
    }
  })

  it('does not extend the window on later calls within it', async () => {
    vi.useFakeTimers()
    const { rateLimit } = await loadRateLimit()
    const key = 'login:email:bob@example.com'
    const config = { windowMs: 60_000, max: 5 }

    await rateLimit(key, config)
    const firstExpiry = fake.store.get(`rl:${key}`)?.expiresAt
    expect(firstExpiry).toEqual(expect.any(Number))
    vi.advanceTimersByTime(30_000)
    await rateLimit(key, config)

    expect(fake.store.get(`rl:${key}`)?.expiresAt).toBe(firstExpiry)
  })
})

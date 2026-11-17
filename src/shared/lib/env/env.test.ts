import { describe, expect, it } from 'vitest'

import { parseServerEnv } from './index'

// The smallest server environment that validates; each test adds to it.
const required = {
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
}

describe('parseServerEnv: rate-limit Redis credentials', () => {
  it('accepts neither KV variable (in-memory rate limiting)', () => {
    expect(parseServerEnv(required).success).toBe(true)
  })

  it('accepts both KV variables together', () => {
    const parsed = parseServerEnv({
      ...required,
      KV_REST_API_URL: 'https://example.upstash.io',
      KV_REST_API_TOKEN: 'token',
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects a URL without a token and names the missing variable', () => {
    const parsed = parseServerEnv({ ...required, KV_REST_API_URL: 'https://example.upstash.io' })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.flatten().fieldErrors).toHaveProperty('KV_REST_API_TOKEN')
  })

  it('rejects a token without a URL and names the missing variable', () => {
    const parsed = parseServerEnv({ ...required, KV_REST_API_TOKEN: 'token' })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.flatten().fieldErrors).toHaveProperty('KV_REST_API_URL')
  })

  it('treats a blank value as missing', () => {
    const parsed = parseServerEnv({
      ...required,
      KV_REST_API_URL: 'https://example.upstash.io',
      KV_REST_API_TOKEN: '  ',
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.flatten().fieldErrors).toHaveProperty('KV_REST_API_TOKEN')
  })
})

describe('parseServerEnv: ANONYMOUS_SIGN_INS_ENABLED', () => {
  it.each([undefined, '', 'true', 'false'])('accepts %o', (value) => {
    expect(parseServerEnv({ ...required, ANONYMOUS_SIGN_INS_ENABLED: value }).success).toBe(true)
  })

  it('refuses to start with a value that is neither "true" nor "false"', () => {
    const parsed = parseServerEnv({ ...required, ANONYMOUS_SIGN_INS_ENABLED: 'no' })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.flatten().fieldErrors).toHaveProperty('ANONYMOUS_SIGN_INS_ENABLED')
  })
})

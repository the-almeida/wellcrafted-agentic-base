import { describe, expect, it } from 'vitest'

import { oauthCallbackInputSchema } from './oauth-callback.schema'

describe('oauthCallbackInputSchema', () => {
  it('parses valid code with missing next, defaulting next to /dashboard', () => {
    const result = oauthCallbackInputSchema.safeParse({ code: 'valid-code-abc123' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        code: 'valid-code-abc123',
        next: '/dashboard',
        from: '/sign-in',
      })
    }
  })

  it('preserves a valid relative next path', () => {
    const result = oauthCallbackInputSchema.safeParse({
      code: 'valid-code-abc123',
      next: '/settings',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.next).toBe('/settings')
    }
  })

  it('rejects an empty code', () => {
    const result = oauthCallbackInputSchema.safeParse({ code: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a whitespace-only code', () => {
    const result = oauthCallbackInputSchema.safeParse({ code: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects a code longer than 128 characters', () => {
    const result = oauthCallbackInputSchema.safeParse({ code: 'a'.repeat(129) })
    expect(result.success).toBe(false)
  })

  it('rejects a protocol-relative next (open redirect)', () => {
    const result = oauthCallbackInputSchema.safeParse({
      code: 'valid-code',
      next: '//evil.com',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an absolute URL next', () => {
    const result = oauthCallbackInputSchema.safeParse({
      code: 'valid-code',
      next: 'https://evil.com/path',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a next containing a backslash (browser-normalised open redirect)', () => {
    const result = oauthCallbackInputSchema.safeParse({
      code: 'valid-code',
      next: '/\\evil.com',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a javascript: scheme next (xss via redirect)', () => {
    const result = oauthCallbackInputSchema.safeParse({
      code: 'valid-code',
      next: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a next that does not start with /', () => {
    const result = oauthCallbackInputSchema.safeParse({
      code: 'valid-code',
      next: 'dashboard',
    })
    expect(result.success).toBe(false)
  })

  it('defaults `from` to /sign-in when not provided', () => {
    const result = oauthCallbackInputSchema.safeParse({ code: 'valid-code' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.from).toBe('/sign-in')
    }
  })

  it('accepts `from=/sign-up`', () => {
    const result = oauthCallbackInputSchema.safeParse({
      code: 'valid-code',
      from: '/sign-up',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.from).toBe('/sign-up')
    }
  })

  it('rejects `from` values outside the allow-list (open-redirect guard)', () => {
    for (const hostile of ['/dashboard', 'https://evil.com', '/sign-in/../etc', '//evil.com']) {
      const result = oauthCallbackInputSchema.safeParse({
        code: 'valid-code',
        from: hostile,
      })
      expect(result.success, `expected reject for from=${hostile}`).toBe(false)
    }
  })
})

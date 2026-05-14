import { describe, expect, it } from 'vitest'

import { signInSchema } from './sign-in.schema'

describe('signInSchema', () => {
  it('accepts a valid email + password', () => {
    const result = signInSchema.safeParse({ email: 'alice@example.com', password: 'password123' })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = signInSchema.safeParse({ email: 'not-an-email', password: 'password123' })
    expect(result.success).toBe(false)
  })

  it('rejects a too-short password', () => {
    const result = signInSchema.safeParse({ email: 'alice@example.com', password: 'short' })
    expect(result.success).toBe(false)
  })
})

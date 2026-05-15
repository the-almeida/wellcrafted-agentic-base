import { describe, expect, it } from 'vitest'

import { verifyOtpSchema } from './verify-otp.schema'

describe('verifyOtpSchema', () => {
  it('accepts a valid email and 6-digit token', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'alice@example.com',
      token: '123456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty token', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'alice@example.com',
      token: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a 5-digit token', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'alice@example.com',
      token: '12345',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a 7-digit token', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'alice@example.com',
      token: '1234567',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-numeric token', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'alice@example.com',
      token: 'abcdef',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'not-an-email',
      token: '123456',
    })
    expect(result.success).toBe(false)
  })
})

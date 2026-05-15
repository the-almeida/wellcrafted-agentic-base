import { describe, expect, it } from 'vitest'

import { requestSignUpOtpSchema } from './request-sign-up-otp.schema'

describe('requestSignUpOtpSchema', () => {
  it('accepts a valid email + name', () => {
    const result = requestSignUpOtpSchema.safeParse({
      email: 'alice@example.com',
      name: 'Alice',
    })
    expect(result.success).toBe(true)
  })

  it('rejects when name is missing', () => {
    const result = requestSignUpOtpSchema.safeParse({ email: 'alice@example.com' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty name', () => {
    const result = requestSignUpOtpSchema.safeParse({
      email: 'alice@example.com',
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a whitespace-only name', () => {
    const result = requestSignUpOtpSchema.safeParse({
      email: 'alice@example.com',
      name: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = requestSignUpOtpSchema.safeParse({
      email: 'not-an-email',
      name: 'Alice',
    })
    expect(result.success).toBe(false)
  })
})

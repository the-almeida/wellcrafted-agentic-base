import { describe, expect, it } from 'vitest'

import { requestSignInOtpSchema } from './request-sign-in-otp.schema'

describe('requestSignInOtpSchema', () => {
  it('accepts a valid email', () => {
    const result = requestSignInOtpSchema.safeParse({ email: 'alice@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = requestSignInOtpSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing email', () => {
    const result = requestSignInOtpSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { signUpSchema } from './sign-up.schema'

describe('signUpSchema', () => {
  it('accepts valid input with name', () => {
    const result = signUpSchema.safeParse({
      email: 'alice@example.com',
      password: 'password123',
      name: 'Alice',
    })
    expect(result.success).toBe(true)
  })

  it('rejects when name is missing', () => {
    const result = signUpSchema.safeParse({
      email: 'alice@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty name', () => {
    const result = signUpSchema.safeParse({
      email: 'alice@example.com',
      password: 'password123',
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a whitespace-only name', () => {
    const result = signUpSchema.safeParse({
      email: 'alice@example.com',
      password: 'password123',
      name: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = signUpSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })
})

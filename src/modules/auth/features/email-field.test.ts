import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'

import { requestSignInOtpSchema } from './request-sign-in-otp/request-sign-in-otp.schema'
import { requestSignUpOtpSchema } from './request-sign-up-otp/request-sign-up-otp.schema'
import { signInSchema } from './sign-in/sign-in.schema'
import { signUpSchema } from './sign-up/sign-up.schema'
import { verifyOtpSchema } from './verify-otp/verify-otp.schema'

// Every auth slice must take its email field from domain/email.ts, so this
// sweeps them all. RFC 5321 caps a forward path at 254 characters. Anything longer is not a
// deliverable address, and accepting it lets a caller write arbitrarily large
// per-email rate-limit keys (one ~1 MB key per request fills Redis, and a full
// Redis makes the limiter fail open for everyone).
function emailOfLength(length: number): string {
  const local = 'a'.repeat(64)
  const suffix = '.com'
  let domain = ''
  const labelsLength = length - local.length - 1 - suffix.length
  while (domain.length < labelsLength) {
    const remaining = labelsLength - domain.length
    const label = 'b'.repeat(Math.min(63, remaining - (domain ? 1 : 0)))
    domain += (domain ? '.' : '') + label
  }
  const email = `${local}@${domain}${suffix}`
  if (email.length !== length) throw new Error(`built ${email.length}, wanted ${length}`)
  return email
}

const schemas: Record<string, ZodType> = {
  signInSchema,
  signUpSchema,
  requestSignInOtpSchema,
  requestSignUpOtpSchema,
  verifyOtpSchema,
}

function emailIssues(schema: ZodType, email: string) {
  const parsed = schema.safeParse({ email })
  return parsed.success ? [] : parsed.error.issues.filter((issue) => issue.path[0] === 'email')
}

describe.each(Object.entries(schemas))('%s email field', (_name, schema) => {
  it('accepts an address of the maximum length, 254 characters', () => {
    expect(emailIssues(schema, emailOfLength(254))).toEqual([])
  })

  it('rejects an address longer than 254 characters', () => {
    expect(emailIssues(schema, emailOfLength(255))).toEqual([
      expect.objectContaining({ code: 'too_big', maximum: 254 }),
    ])
  })
})

import { describe, expect, it } from 'vitest'

import { rateLimitKey } from './key'

describe('rateLimitKey', () => {
  it('puts every spelling of one email address in the same bucket', () => {
    const canonical = rateLimitKey('sign-in', 'email', 'fulano@x.com')

    expect(rateLimitKey('sign-in', 'email', 'Fulano@X.com')).toBe(canonical)
    expect(rateLimitKey('sign-in', 'email', '  FULANO@x.COM ')).toBe(canonical)
    expect(canonical).toBe('sign-in:email:fulano@x.com')
  })

  it('keeps different email addresses in different buckets', () => {
    expect(rateLimitKey('sign-in', 'email', 'fulano@x.com')).not.toBe(
      rateLimitKey('sign-in', 'email', 'beltrano@x.com'),
    )
  })

  it('keeps the same subject in different buckets per endpoint', () => {
    expect(rateLimitKey('sign-in', 'email', 'fulano@x.com')).not.toBe(
      rateLimitKey('sign-up', 'email', 'fulano@x.com'),
    )
  })

  it('leaves ip and user subjects as given', () => {
    expect(rateLimitKey('sign-in', 'ip', '2001:DB8::1')).toBe('sign-in:ip:2001:DB8::1')
    expect(rateLimitKey('account-deletion', 'user', 'AbC-123')).toBe(
      'account-deletion:user:AbC-123',
    )
  })
})

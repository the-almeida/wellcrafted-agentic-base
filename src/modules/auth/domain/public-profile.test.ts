import { describe, expect, it } from 'vitest'

import { displayName, formatPublicHandle } from './public-profile'

describe('formatPublicHandle', () => {
  it.each([
    [42, 'Wolf #0042'],
    [1, 'Wolf #0001'],
    [9999, 'Wolf #9999'],
  ])('shows discriminator %i as four digits', (discriminator, expected) => {
    expect(formatPublicHandle({ nickname: 'Wolf', discriminator })).toBe(expected)
  })
})

describe('displayName', () => {
  const profile = { nickname: 'Wolf', discriminator: 7 }

  it('uses the name when the account has one', () => {
    expect(displayName({ name: 'Ana', profile })).toBe('Ana')
  })

  it('uses the public handle when there is no name (anonymous or converted)', () => {
    expect(displayName({ name: null, profile })).toBe('Wolf #0007')
  })

  it('falls back to the email when there is neither', () => {
    expect(displayName({ name: null, profile: null, email: 'a@b.test' })).toBe('a@b.test')
  })
})

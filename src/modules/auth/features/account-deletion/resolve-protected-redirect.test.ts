import { describe, expect, it } from 'vitest'

import { UserIdSchema } from '@/shared/lib/ids'

import type { User } from '../../domain/user'

import { resolveProtectedRouteRedirect } from './resolve-protected-redirect'

function user(pendingDeletion: User['pendingDeletion']): User {
  return {
    id: UserIdSchema.parse('00000000-0000-4000-8000-000000000001'),
    email: 'someone@example.test',
    name: 'Someone',
    role: 'user',
    pendingDeletion,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const pending = user({ scheduledFor: new Date('2030-01-01T00:00:00Z') })
const active = user(null)

describe('resolveProtectedRouteRedirect', () => {
  it('sends a pending-deletion user to the interstitial when on any other protected path', () => {
    expect(resolveProtectedRouteRedirect(pending, '/dashboard')).toBe('/account/pending-deletion')
    expect(resolveProtectedRouteRedirect(pending, '/account')).toBe('/account/pending-deletion')
  })

  it('does not redirect a pending-deletion user already on the interstitial', () => {
    expect(resolveProtectedRouteRedirect(pending, '/account/pending-deletion')).toBeNull()
  })

  it('redirects a user with no active request away from the interstitial to /account', () => {
    expect(resolveProtectedRouteRedirect(active, '/account/pending-deletion')).toBe('/account')
  })

  it('does not redirect a normal user on a normal protected path', () => {
    expect(resolveProtectedRouteRedirect(active, '/dashboard')).toBeNull()
    expect(resolveProtectedRouteRedirect(active, '/account')).toBeNull()
  })
})

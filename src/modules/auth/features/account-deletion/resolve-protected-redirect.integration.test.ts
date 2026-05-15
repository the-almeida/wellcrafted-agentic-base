import { inArray } from 'drizzle-orm'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { accountDeletionRequests } from '@/shared/db/schema'
import { cleanupAuthUser, getAdminSupabase, uniqueTestEmail } from '@/shared/db/test-helpers'
import {
  AccountDeletionRequestIdSchema,
  UserIdSchema,
  type AccountDeletionRequestId,
  type UserId,
} from '@/shared/lib/ids'

import { requestAccountDeletionForUser } from './request-account-deletion.logic'
import { resolveProtectedRouteRedirect } from './resolve-protected-redirect'

describe('resolveProtectedRouteRedirect', () => {
  let createdUserIds: string[] = []
  let createdRequestIds: AccountDeletionRequestId[] = []

  beforeAll(() => {
    getAdminSupabase()
  })

  afterEach(async () => {
    if (createdRequestIds.length > 0) {
      await db
        .delete(accountDeletionRequests)
        .where(inArray(accountDeletionRequests.id, createdRequestIds))
    }
    createdRequestIds = []
    for (const id of createdUserIds) {
      await cleanupAuthUser(id)
    }
    createdUserIds = []
  })

  async function seedUserWithActiveDeletion(prefix: string): Promise<UserId> {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail(prefix),
      email_confirm: true,
      user_metadata: { name: `Redirect ${prefix}` },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    createdUserIds.push(data.user.id)
    const userId = UserIdSchema.parse(data.user.id)

    const requested = await requestAccountDeletionForUser({
      id: userId,
      email: data.user.email!,
      name: `Redirect ${prefix}`,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    if (!requested.ok) throw requested.error
    createdRequestIds.push(AccountDeletionRequestIdSchema.parse(requested.value.id))
    return userId
  }

  it('sends a pending-deletion user to the interstitial when on any other protected path', async () => {
    const userId = await seedUserWithActiveDeletion('to-interstitial')

    expect(await resolveProtectedRouteRedirect(userId, '/dashboard')).toBe(
      '/account/pending-deletion',
    )
    expect(await resolveProtectedRouteRedirect(userId, '/account')).toBe(
      '/account/pending-deletion',
    )
  })

  it('does not redirect a pending-deletion user already on the interstitial', async () => {
    const userId = await seedUserWithActiveDeletion('on-interstitial')

    const result = await resolveProtectedRouteRedirect(userId, '/account/pending-deletion')
    expect(result).toBeNull()
  })

  it('redirects a user with no active request away from the interstitial to /account', async () => {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail('no-deletion'),
      email_confirm: true,
      user_metadata: { name: 'No Deletion' },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    createdUserIds.push(data.user.id)
    const userId = UserIdSchema.parse(data.user.id)

    const result = await resolveProtectedRouteRedirect(userId, '/account/pending-deletion')
    expect(result).toBe('/account')
  })

  it('does not redirect a normal user on a normal protected path', async () => {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.auth.admin.createUser({
      email: uniqueTestEmail('normal'),
      email_confirm: true,
      user_metadata: { name: 'Normal User' },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('user not returned')
    createdUserIds.push(data.user.id)
    const userId = UserIdSchema.parse(data.user.id)

    expect(await resolveProtectedRouteRedirect(userId, '/dashboard')).toBeNull()
    expect(await resolveProtectedRouteRedirect(userId, '/account')).toBeNull()
  })
})

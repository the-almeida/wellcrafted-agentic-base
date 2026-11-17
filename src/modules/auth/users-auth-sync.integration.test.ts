import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { users } from '@/shared/db/schema/auth'
import {
  cleanupAuthUser,
  createAnonSupabase,
  createTestUser,
  getAdminSupabase,
  uniqueTestEmail,
} from '@/shared/db/test-helpers'
import type { UserId } from '@/shared/lib/ids'

// How changes to auth.users (made by Supabase Auth) reach the app's
// public.users mirror.

const createdUserIds: string[] = []
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await cleanupAuthUser(id)
})

async function seeded() {
  const user = await createTestUser({ prefix: 'sync' })
  createdUserIds.push(user.id)
  return user
}

const row = async (id: UserId) => (await db.select().from(users).where(eq(users.id, id)))[0]

describe('public.users sync from auth.users updates', () => {
  it('follows an email change', async () => {
    const user = await seeded()
    const newEmail = uniqueTestEmail('sync-new')

    const { error } = await getAdminSupabase().auth.admin.updateUserById(user.id, {
      email: newEmail,
      email_confirm: true,
    })

    expect(error).toBeNull()
    expect(await row(user.id)).toMatchObject({ email: newEmail })
  })

  it('forgets the verification when the email changes: the new address is unproven', async () => {
    const user = await seeded()
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id))

    await getAdminSupabase().auth.admin.updateUserById(user.id, {
      email: uniqueTestEmail('sync-new'),
      email_confirm: true,
    })

    expect(await row(user.id)).toMatchObject({ emailVerifiedAt: null })
  })

  it('does not copy user metadata, which users can edit themselves', async () => {
    const user = await seeded()

    await getAdminSupabase().auth.admin.updateUserById(user.id, {
      user_metadata: { name: 'Edited through Supabase' },
    })

    expect(await row(user.id)).toMatchObject({ name: user.name })
  })

  it('leaves the row alone on a sign-in', async () => {
    const user = await seeded()
    const password = `pw-${randomUUID()}`
    await getAdminSupabase().auth.admin.updateUserById(user.id, { password })
    const before = await row(user.id)

    const { error } = await createAnonSupabase().auth.signInWithPassword({
      email: user.email,
      password,
    })

    expect(error).toBeNull()
    expect(await row(user.id)).toEqual(before)
  })
})

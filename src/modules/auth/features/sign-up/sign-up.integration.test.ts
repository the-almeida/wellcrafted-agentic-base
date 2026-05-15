import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { users } from '@/shared/db/schema'
import {
  cleanupAuthUser,
  createAnonSupabase,
  getAdminSupabase,
  uniqueTestEmail,
} from '@/shared/db/test-helpers'
import { UserIdSchema } from '@/shared/lib/ids'

describe('auth.users → public.users trigger', () => {
  let createdUserIds: string[] = []

  beforeAll(() => {
    // Force-load the admin client once so a misconfigured env fails fast,
    // before any test attempts to run.
    getAdminSupabase()
  })

  afterEach(async () => {
    for (const id of createdUserIds) {
      await cleanupAuthUser(id)
    }
    createdUserIds = []
  })

  it('mirrors a new auth user into public.users with name from metadata', async () => {
    const supabase = getAdminSupabase()
    const email = uniqueTestEmail()

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: 'Alice Example' },
    })
    expect(error).toBeNull()
    expect(data.user).not.toBeNull()
    if (!data.user) throw new Error('user not returned')

    createdUserIds.push(data.user.id)

    const userId = UserIdSchema.parse(data.user.id)
    const rows = await db.select().from(users).where(eq(users.id, userId))

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: userId,
      email,
      name: 'Alice Example',
      role: 'user',
    })
  })

  it('carries name through password sign-up (anon-key signUp path)', async () => {
    // Mirrors what the browser sends via our auth-provider.supabase
    // adapter: `auth.signUp({ email, password, options: { data: { name } } })`.
    // If a future change moves `name` to a different key, this test fails
    // even though the unit tests still pass.
    const anon = createAnonSupabase()
    const email = uniqueTestEmail('signup')

    const { data, error } = await anon.auth.signUp({
      email,
      password: 'integration-test-password',
      options: { data: { name: 'Bob Example' } },
    })
    expect(error).toBeNull()
    expect(data.user).not.toBeNull()
    if (!data.user) throw new Error('user not returned')

    createdUserIds.push(data.user.id)

    const userId = UserIdSchema.parse(data.user.id)
    const rows = await db.select().from(users).where(eq(users.id, userId))

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: userId,
      email,
      name: 'Bob Example',
      role: 'user',
    })
  })
})

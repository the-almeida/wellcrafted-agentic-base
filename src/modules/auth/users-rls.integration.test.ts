import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { users } from '@/shared/db/schema'
import {
  cleanupAuthUser,
  createAnonSupabase,
  createTestUser,
  getAdminSupabase,
} from '@/shared/db/test-helpers'

// public.users through the public API with the anon key: what anyone who
// opens the browser devtools can do. The app reads it with the service role
// (RLS does not apply); RLS here is the defense for every other caller.

const createdUserIds: string[] = []
afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await cleanupAuthUser(id)
})

async function signedInClient() {
  const seeded = await createTestUser({ prefix: 'users-rls' })
  createdUserIds.push(seeded.id)
  const password = `pw-${randomUUID()}`
  await getAdminSupabase().auth.admin.updateUserById(seeded.id, { password })
  const client = createAnonSupabase()
  const signIn = await client.auth.signInWithPassword({ email: seeded.email, password })
  if (signIn.error) throw signIn.error
  return { client, userId: seeded.id }
}

describe('public.users RLS', () => {
  it('shows no rows to a caller with only the anon key', async () => {
    const someone = await createTestUser({ prefix: 'users-rls' })
    createdUserIds.push(someone.id)

    const { data, error } = await createAnonSupabase().from('users').select('id, email')

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('shows a signed-in user only their own row', async () => {
    const other = await createTestUser({ prefix: 'users-rls' })
    createdUserIds.push(other.id)
    const { client, userId } = await signedInClient()

    const { data, error } = await client.from('users').select('id')

    expect(error).toBeNull()
    expect(data).toEqual([{ id: userId }])
  })

  it('does not let a signed-in user change their own row, role included', async () => {
    const { client, userId } = await signedInClient()

    await client.from('users').update({ role: 'admin', name: 'Hijacked' }).eq('id', userId)

    const [row] = await db.select().from(users).where(eq(users.id, userId))
    expect(row).toMatchObject({ role: 'user', name: 'Test users-rls' })
  })

  it('does not let a signed-in user delete their own row', async () => {
    const { client, userId } = await signedInClient()

    await client.from('users').delete().eq('id', userId)

    const rows = await db.select().from(users).where(eq(users.id, userId))
    expect(rows).toHaveLength(1)
  })
})

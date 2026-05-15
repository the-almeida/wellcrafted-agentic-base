import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { users } from '@/shared/db/schema'
import {
  cleanupAuthUser,
  cleanupMailpitFor,
  createAnonSupabase,
  getAdminSupabase,
  pollMailpitForOtp,
  uniqueTestEmail,
} from '@/shared/db/test-helpers'
import { UserIdSchema } from '@/shared/lib/ids'

describe('OTP sign-up: request → email → verify → public.users sync', () => {
  let createdUserIds: string[] = []
  let createdEmails: string[] = []

  beforeAll(() => {
    getAdminSupabase()
  })

  afterEach(async () => {
    for (const id of createdUserIds) {
      await cleanupAuthUser(id)
    }
    for (const email of createdEmails) {
      await cleanupMailpitFor(email)
    }
    createdUserIds = []
    createdEmails = []
  })

  it(
    'creates the user with name in public.users when the code is verified',
    { timeout: 15_000 },
    async () => {
      const anon = createAnonSupabase()
      const email = uniqueTestEmail('otp-signup')
      createdEmails.push(email)

      // Mirrors what requestSignUpOtp's adapter does internally.
      const requestResult = await anon.auth.signInWithOtp({
        email,
        options: { data: { name: 'Carol Example' }, shouldCreateUser: true },
      })
      expect(requestResult.error).toBeNull()

      const token = await pollMailpitForOtp(email)

      const verifyResult = await anon.auth.verifyOtp({ email, token, type: 'email' })
      expect(verifyResult.error).toBeNull()
      expect(verifyResult.data.user).not.toBeNull()
      if (!verifyResult.data.user) throw new Error('verifyOtp returned no user')

      createdUserIds.push(verifyResult.data.user.id)

      const userId = UserIdSchema.parse(verifyResult.data.user.id)
      const rows = await db.select().from(users).where(eq(users.id, userId))

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        id: userId,
        email,
        name: 'Carol Example',
        role: 'user',
      })
    },
  )
})

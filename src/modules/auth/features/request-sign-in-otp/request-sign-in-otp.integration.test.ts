import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  cleanupAuthUser,
  cleanupMailpitFor,
  createAnonSupabase,
  getAdminSupabase,
  pollMailpitForOtp,
  uniqueTestEmail,
} from '@/shared/db/test-helpers'

describe('OTP sign-in (shouldCreateUser=false)', () => {
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
    'sends a code to a registered user and signs them in on verify',
    { timeout: 15_000 },
    async () => {
      const admin = getAdminSupabase()
      const email = uniqueTestEmail('otp-signin')
      createdEmails.push(email)

      // Seed a registered user. email_confirm=true so signInWithOtp
      // proceeds without bouncing on unconfirmed email.
      const seed = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: 'Dave Existing' },
      })
      expect(seed.error).toBeNull()
      if (!seed.data.user) throw new Error('seed user missing')
      createdUserIds.push(seed.data.user.id)

      const anon = createAnonSupabase()
      const request = await anon.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      expect(request.error).toBeNull()

      const token = await pollMailpitForOtp(email)

      const verify = await anon.auth.verifyOtp({ email, token, type: 'email' })
      expect(verify.error).toBeNull()
      expect(verify.data.user?.id).toBe(seed.data.user.id)
      expect(verify.data.session).not.toBeNull()
    },
  )

  it('refuses to send a code to an unregistered email and Mailpit stays empty', async () => {
    const anon = createAnonSupabase()
    const email = uniqueTestEmail('otp-unknown')
    createdEmails.push(email)

    const request = await anon.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })

    // Supabase surfaces "Signups not allowed for otp" (or similar) for
    // unregistered emails when shouldCreateUser=false. We don't pin the
    // exact message — only that an error happened and no email was sent.
    expect(request.error).not.toBeNull()

    // Wait briefly to give an accidental email time to arrive, then
    // confirm the mailbox stayed empty. 1s is plenty against local SMTP.
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const list = await fetch(
      `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    )
    const json = (await list.json()) as { messages: unknown[] }
    expect(json.messages).toHaveLength(0)
  })
})

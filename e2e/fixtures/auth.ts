import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from '@/shared/lib/env'

import { test as base } from './axe'

/**
 * E2E helpers for the auth flows. Mirrors the shape of
 * `src/shared/db/test-helpers.ts` at the Playwright surface — kept
 * separate because the integration-test helpers run inside vitest's
 * Node worker, while these run inside Playwright's worker.
 *
 * `playwright.config.ts` loads `.env.local` into `process.env` before
 * the env module's startup validation runs, so importing `env` here is
 * safe and identical to the in-app env access.
 */

let adminClient: SupabaseClient | null = null

function getAdmin(): SupabaseClient {
  if (adminClient) return adminClient
  adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminClient
}

const MAILPIT_URL = 'http://127.0.0.1:54324'

export type SeededUser = {
  id: string
  email: string
  password: string
  name: string
}

type AuthFixtures = {
  seedUser: (
    overrides?: Partial<Pick<SeededUser, 'email' | 'password' | 'name'>>,
  ) => Promise<SeededUser>
  pollOtp: (recipient: string) => Promise<string>
  uniqueEmail: (prefix?: string) => string
}

export const test = base.extend<AuthFixtures>({
  uniqueEmail: async ({}, use) => {
    await use((prefix = 'e2e') => `${prefix}-${randomUUID()}@integration.test`)
  },
  pollOtp: async ({}, use) => {
    await use(async (recipient: string) => {
      const query = `to:${recipient}`
      for (let attempt = 0; attempt < 20; attempt++) {
        const list = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`)
        if (list.ok) {
          const json = (await list.json()) as { messages: { ID: string }[] }
          if (json.messages.length > 0) {
            const id = json.messages[0]!.ID
            const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)
            if (detail.ok) {
              const message = (await detail.json()) as { Text?: string; HTML?: string }
              const body = `${message.Text ?? ''}\n${message.HTML ?? ''}`
              const match = body.match(/\b(\d{6})\b/)
              if (match) return match[1]!
            }
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      throw new Error(`Mailpit: no OTP for ${recipient} within 10s`)
    })
  },
  seedUser: async ({}, use) => {
    const created: string[] = []
    const recipients: string[] = []

    await use(async (overrides) => {
      const admin = getAdmin()
      const user: SeededUser = {
        id: '',
        email: overrides?.email ?? `seeded-${randomUUID()}@integration.test`,
        password: overrides?.password ?? `e2e-pw-${randomUUID()}`,
        name: overrides?.name ?? 'Seeded User',
      }

      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { name: user.name },
      })
      if (error) throw new Error(`seedUser: ${error.message}`)
      if (!data.user) throw new Error('seedUser: no user returned')

      user.id = data.user.id
      created.push(user.id)
      recipients.push(user.email)
      return user
    })

    // Per-test cleanup. Cascade deletes the public.users mirror; Mailpit
    // cleanup keeps the local mailbox tidy across runs.
    const admin = getAdmin()
    for (const id of created) {
      await admin.auth.admin.deleteUser(id)
    }
    for (const email of recipients) {
      const list = await fetch(
        `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      )
      if (!list.ok) continue
      const json = (await list.json()) as { messages: { ID: string }[] }
      if (json.messages.length === 0) continue
      await fetch(`${MAILPIT_URL}/api/v1/messages`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: json.messages.map((m) => m.ID) }),
      })
    }
  },
})

export { expect } from './axe'

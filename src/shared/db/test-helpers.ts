import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from '@/shared/lib/env'

/**
 * Shared infrastructure for integration tests.
 *
 * The admin Supabase client uses the service role key and bypasses RLS —
 * used to seed/clean auth.users directly, scrape Mailpit, etc. Never
 * import this from production code.
 */

let adminClient: SupabaseClient | null = null

export function getAdminSupabase(): SupabaseClient {
  if (adminClient) return adminClient
  adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminClient
}

/**
 * Anon-key Supabase client — same posture as the browser. Used to
 * exercise public auth flows (signUp, signInWithOtp) end-to-end and
 * verify the contract between our request payloads and the trigger.
 *
 * Each call returns a fresh client so tests can't share auth state by
 * accident.
 */
export function createAnonSupabase(): SupabaseClient {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Generates a unique `.integration.test` email per test.
 *
 * The `.test` TLD is reserved (RFC 6761) and never resolves on the
 * public internet — safe to use in tests without colliding with real
 * mail or upstream rate limits.
 */
export function uniqueTestEmail(prefix = 'user'): string {
  return `${prefix}-${randomUUID()}@integration.test`
}

/**
 * Removes an auth user (and via `ON DELETE CASCADE`, its public.users
 * mirror). Safe to call repeatedly; missing IDs are tolerated.
 */
export async function cleanupAuthUser(userId: string): Promise<void> {
  const supabase = getAdminSupabase()
  await supabase.auth.admin.deleteUser(userId)
}

/**
 * Polls Mailpit for an email delivered to `recipient` and returns the
 * first 6-digit code found in the message body. Supabase OTP emails
 * embed the code in the plain-text version; the magic-link template
 * also includes the code as a fallback, so this is robust to template
 * choice.
 *
 * Times out after ~5 seconds (10 polls × 500ms). If no message
 * arrives, throws — callers should treat that as a test failure, not
 * retry indefinitely.
 */
const MAILPIT_URL = 'http://127.0.0.1:54324'

export async function pollMailpitForOtp(recipient: string): Promise<string> {
  const query = `to:${recipient}`
  for (let attempt = 0; attempt < 10; attempt++) {
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
  throw new Error(`Mailpit: no OTP message arrived for ${recipient} within 5s`)
}

/**
 * Deletes all Mailpit messages addressed to `recipient`. Use in
 * cleanup to keep the mailbox tidy across runs.
 */
export async function cleanupMailpitFor(recipient: string): Promise<void> {
  const query = `to:${recipient}`
  const list = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`)
  if (!list.ok) return
  const json = (await list.json()) as { messages: { ID: string }[] }
  if (json.messages.length === 0) return
  await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids: json.messages.map((m) => m.ID) }),
  })
}

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

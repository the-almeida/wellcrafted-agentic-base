import type { NextRequest } from 'next/server'

import { createSupabaseMiddlewareClient } from './middleware-client'

/**
 * Refreshes the Supabase auth session if needed and writes any rotated
 * cookies onto the response. Must be called from the proxy on every
 * request that touches authenticated content.
 *
 * Uses `getUser()` (not `getSession()`) because `getUser()` round-trips
 * to the Supabase auth API and returns a verified result. `getSession()`
 * reads cookies directly and is not safe for authorization decisions.
 *
 * Anonymous traffic and stale refresh-token cookies trigger AuthApiError
 * throws inside the SDK that are benign (Supabase clears the offending
 * cookies via the `setAll` callback before throwing). Swallow them so the
 * proxy stays quiet for unauthenticated requests; real network or config
 * failures will still surface elsewhere.
 */
export async function updateSession(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request)
  try {
    await supabase.auth.getUser()
  } catch {
    // intentionally ignored — see jsdoc
  }
  return response
}

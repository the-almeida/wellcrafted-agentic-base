import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { env } from '@/shared/lib/env'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch (error) {
          // `cookies().set()` throws when called from a Server Component
          // (Next.js: cookies are read-only there). This is expected, and
          // middleware refreshes the session on the next request, so we
          // intentionally no-op for that specific case.
          //
          // Any other error indicates an actual problem that should surface.
          const message = error instanceof Error ? error.message : ''
          const isReadOnlyCookies = message.includes('Cookies can only be modified')
          if (!isReadOnlyCookies) throw error
        }
      },
    },
  })
}

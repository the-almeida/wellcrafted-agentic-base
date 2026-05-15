import { NextResponse } from 'next/server'

import { exchangeOauthCode, oauthCallbackInputSchema } from '@/modules/auth'

/**
 * OAuth callback. Providers (Google, Facebook) redirect here with
 * `?code=<authorization_code>` after the user signs in. We exchange the
 * code for a Supabase session — which writes auth cookies on the app
 * origin — then send the user to `?next=<path>` (or `/dashboard`).
 *
 * On failure we bounce the user back to whichever page initiated the
 * OAuth flow (`?from=/sign-in` or `?from=/sign-up`) so the error banner
 * appears in the right context — `/sign-up` mentions the profile
 * permission (likely cause for first-time users hitting #24's trigger
 * rejection); `/sign-in` shows neutral retry copy. The `from` value is
 * allow-listed in the schema to prevent open-redirect abuse.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const parsed = oauthCallbackInputSchema.safeParse({
    code: searchParams.get('code') ?? undefined,
    next: searchParams.get('next') ?? undefined,
    from: searchParams.get('from') ?? undefined,
  })
  if (!parsed.success) {
    // We can't trust the `from` value when the schema rejects, so fall
    // back to /sign-in (the project-wide default).
    return NextResponse.redirect(`${origin}/sign-in?error=invalid_callback`)
  }

  const result = await exchangeOauthCode(parsed.data.code)
  if (!result.ok) {
    // Includes the trigger-rejected "no name" case — Supabase wraps the
    // trigger RAISE EXCEPTION as a generic "Database error" so we can't
    // distinguish it here. The originating page's banner shows the
    // appropriate hint.
    return NextResponse.redirect(`${origin}${parsed.data.from}?error=oauth_failed`)
  }

  return NextResponse.redirect(`${origin}${parsed.data.next}`)
}

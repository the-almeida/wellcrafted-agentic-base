import { NextResponse } from 'next/server'

import { exchangeOauthCode } from '@/modules/auth'

/**
 * OAuth callback. Providers (Google, Facebook) redirect here with
 * `?code=<authorization_code>` after the user signs in. We exchange the
 * code for a Supabase session — which writes auth cookies on the app
 * origin — then send the user to `?next=<path>` (or `/dashboard`).
 *
 * On failure (missing code, exchange rejected) we redirect back to
 * `/sign-in` with an `error` query so the form can show a message.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`)
  }

  const result = await exchangeOauthCode(code)
  if (!result.ok) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth_failed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}

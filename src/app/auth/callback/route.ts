import { NextResponse } from 'next/server'

import { exchangeOauthCode, oauthCallbackInputSchema } from '@/modules/auth'

/**
 * OAuth callback. Providers (Google, Facebook) redirect here with
 * `?code=<authorization_code>` after the user signs in. We exchange the
 * code for a Supabase session — which writes auth cookies on the app
 * origin — then send the user to `?next=<path>` (or `/dashboard`).
 *
 * On failure (invalid input, exchange rejected) we redirect back to
 * `/sign-in` with an `error` query so the form can show a message.
 *
 * `next` is validated as a same-origin path to prevent open redirects:
 * see `oauth-callback.schema.ts`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const parsed = oauthCallbackInputSchema.safeParse({
    code: searchParams.get('code') ?? undefined,
    next: searchParams.get('next') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.redirect(`${origin}/sign-in?error=invalid_callback`)
  }

  const result = await exchangeOauthCode(parsed.data.code)
  if (!result.ok) {
    // Includes the trigger-rejected "no name" case (Facebook scope
    // denial, etc.) — Supabase wraps the trigger's RAISE EXCEPTION as
    // a generic "Database error" so we can't distinguish it here. The
    // /sign-in page shows a hint suggesting the user grant the
    // profile permission and retry.
    return NextResponse.redirect(`${origin}/sign-in?error=oauth_failed`)
  }

  return NextResponse.redirect(`${origin}${parsed.data.next}`)
}

import { NextResponse } from 'next/server'

import { env } from '@/shared/lib/env'
import { extractIpFromHeaders } from '@/shared/lib/http/request-ip'
import { rateLimit } from '@/shared/lib/rate-limit'

import { handleFacebookDataDeletion } from '@/modules/auth'

/**
 * Facebook Data Deletion Callback.
 *
 * Facebook POSTs a `signed_request` form field here when a user removes
 * the app from their Facebook account. The signed_request is an
 * HMAC-SHA256-signed payload containing the user's Facebook ID; we
 * verify the signature with the app secret, look up the local user via
 * `auth.identities`, create (or fetch) a deletion request, and respond
 * with the URL where the user can check status plus the
 * `confirmation_code` token.
 *
 * Auto-captured by `instrumentation.ts`'s `onRequestError` hook — no
 * `withErrorBoundary` wrapper needed.
 *
 * Per-IP rate-limited because the endpoint is unauthenticated. The HMAC
 * gate already rejects forged calls, but the limiter caps the CPU cost
 * an attacker can impose by spamming unsigned payloads.
 */

// Reject the request before parsing the form body if Content-Length is
// obviously too large. Real signed_requests are a few hundred bytes;
// see MAX_SIGNED_REQUEST_BYTES in facebook-data-deletion.ts for the
// post-parse cap.
const MAX_BODY_BYTES = 8 * 1024

export async function POST(request: Request) {
  // `FACEBOOK_OAUTH_CLIENT_SECRET` is Facebook's "App Secret" — the same
  // value used both for OAuth and for signed_request HMAC verification.
  // When unset (dev without Facebook configured), refuse the callback
  // rather than verifying with an empty key.
  const appSecret = env.FACEBOOK_OAUTH_CLIENT_SECRET
  if (!appSecret) {
    return NextResponse.json({ error: 'facebook_data_deletion_not_configured' }, { status: 503 })
  }

  const ip = extractIpFromHeaders(request.headers)
  const limit = await rateLimit(`facebook-data-deletion:ip:${ip}`, {
    windowMs: 60_000,
    max: 30,
  })
  if (!limit.ok) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'body_too_large' }, { status: 413 })
  }

  let signedRequest: string | null = null
  try {
    const form = await request.formData()
    const value = form.get('signed_request')
    if (typeof value === 'string') signedRequest = value
  } catch {
    // Fall through to the validation rejection below.
  }
  if (!signedRequest) {
    return NextResponse.json({ error: 'missing_signed_request' }, { status: 400 })
  }

  const statusUrlBase = `${env.NEXT_PUBLIC_APP_URL}/data-deletion/status`
  const result = await handleFacebookDataDeletion({
    signedRequest,
    appSecret,
    statusUrlBase,
  })
  if (!result.ok) {
    return NextResponse.json({ error: 'invalid_signed_request' }, { status: 400 })
  }

  return NextResponse.json({
    url: result.value.url,
    confirmation_code: result.value.confirmationCode,
  })
}

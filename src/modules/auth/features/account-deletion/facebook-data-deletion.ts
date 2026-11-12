import { createHmac, timingSafeEqual } from 'node:crypto'

import { sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/shared/db/client'
import { ValidationError } from '@/shared/lib/errors/base'
import { UserIdSchema, type UserId } from '@/shared/lib/ids'
import { err, ok, type Result } from '@/shared/lib/result'

import { generateConfirmationCode, openDeletionRequest } from './deletion-requests'

export type FacebookDataDeletionResponse = {
  url: string
  confirmationCode: string
}

type Args = {
  signedRequest: string
  appSecret: string
  statusUrlBase: string
}

// Facebook's signed_request is typically a few hundred bytes. Cap well
// above realistic payloads but well below anything that would let an
// attacker burn CPU on HMAC verification of large bodies.
const MAX_SIGNED_REQUEST_BYTES = 4 * 1024

// Reject signed_requests older than this. Facebook's docs don't pin a
// TTL for the data deletion callback, but treating these like OAuth
// signed_requests (typically 5-15 min) gives us replay protection
// without rejecting legitimate retries.
const MAX_SIGNED_REQUEST_AGE_MS = 10 * 60 * 1000

const signedRequestPayloadSchema = z.object({
  algorithm: z.literal('HMAC-SHA256'),
  user_id: z.string().min(1),
  issued_at: z.number().int().nonnegative(),
  expires: z.number().int().nonnegative().optional(),
})

type SignedRequestPayload = z.infer<typeof signedRequestPayloadSchema>

function buildStatusUrl(base: string, code: string): string {
  return `${base}?code=${code}`
}

/**
 * Verifies Facebook's HMAC-SHA256 signed_request and parses the payload
 * through a Zod schema. The signed_request format is
 * `<base64url_signature>.<base64url_payload>`; the signature is
 * HMAC-SHA256 of the encoded payload using the app secret.
 *
 * Returns the validated payload or `null` if any of these fail:
 *   - the input is malformed / over-length;
 *   - the HMAC does not verify (constant-time comparison);
 *   - the payload is not valid JSON or fails schema validation
 *     (which enforces `algorithm === 'HMAC-SHA256'` and required
 *     fields);
 *   - `issued_at` indicates the request is older than
 *     MAX_SIGNED_REQUEST_AGE_MS;
 *   - `expires` (when present) is in the past.
 *
 * All "null" cases collapse to a single `ValidationError` at the call
 * site so the response shape Facebook receives is uniform.
 */
function verifyAndDecodeSignedRequest(
  signedRequest: string,
  appSecret: string,
): SignedRequestPayload | null {
  if (typeof signedRequest !== 'string') return null
  if (signedRequest.length === 0 || signedRequest.length > MAX_SIGNED_REQUEST_BYTES) return null
  const dot = signedRequest.indexOf('.')
  if (dot <= 0 || dot === signedRequest.length - 1) return null

  const signaturePart = signedRequest.slice(0, dot)
  const payloadPart = signedRequest.slice(dot + 1)

  let providedSignature: Buffer
  try {
    providedSignature = Buffer.from(signaturePart, 'base64url')
  } catch {
    return null
  }

  const expectedSignature = createHmac('sha256', appSecret).update(payloadPart).digest()
  if (providedSignature.length !== expectedSignature.length) return null
  if (!timingSafeEqual(providedSignature, expectedSignature)) return null

  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  const parsed = signedRequestPayloadSchema.safeParse(decoded)
  if (!parsed.success) return null

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (parsed.data.issued_at * 1000 + MAX_SIGNED_REQUEST_AGE_MS < Date.now()) return null
  if (parsed.data.expires !== undefined && parsed.data.expires < nowSeconds) return null

  return parsed.data
}

async function findAppUserIdForFacebookId(facebookId: string): Promise<UserId | null> {
  const rows = await db.execute<{ user_id: string }>(
    sql`SELECT user_id FROM auth.identities WHERE provider = 'facebook' AND provider_id = ${facebookId} LIMIT 1`,
  )
  const row = rows[0]
  if (!row) return null
  return UserIdSchema.parse(row.user_id)
}

export async function handleFacebookDataDeletion(
  args: Args,
): Promise<Result<FacebookDataDeletionResponse, ValidationError>> {
  const payload = verifyAndDecodeSignedRequest(args.signedRequest, args.appSecret)
  if (!payload) {
    return err(new ValidationError({ formErrors: ['invalid signed_request'], fieldErrors: {} }))
  }

  const appUserId = await findAppUserIdForFacebookId(payload.user_id)
  if (!appUserId) {
    // No matching identity. Per Facebook's protocol we must still return
    // a valid response so the user receives a status URL; the status
    // page handles unknown codes by rendering the generic "processed or
    // could not be found" message.
    const code = generateConfirmationCode()
    return ok({ url: buildStatusUrl(args.statusUrlBase, code), confirmationCode: code })
  }

  // Idempotent and race-safe: Facebook retries the callback, and the user
  // may request deletion in-app at the same time. Either way there is one
  // active request and every caller gets its confirmation code.
  const request = await openDeletionRequest(appUserId, 'facebook')
  return ok({
    url: buildStatusUrl(args.statusUrlBase, request.confirmationCode),
    confirmationCode: request.confirmationCode,
  })
}

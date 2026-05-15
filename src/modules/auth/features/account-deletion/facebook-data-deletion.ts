import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/shared/db/client'
import { accountDeletionRequests } from '@/shared/db/schema/account-deletion'
import { env } from '@/shared/lib/env'
import { ValidationError } from '@/shared/lib/errors/base'
import { UserIdSchema, type UserId } from '@/shared/lib/ids'
import { err, ok, type Result } from '@/shared/lib/result'

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

function generateConfirmationCode(): string {
  return randomBytes(16).toString('base64url')
}

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

async function findActiveRequest(userId: UserId) {
  const [row] = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.userId, userId),
        isNull(accountDeletionRequests.cancelledAt),
        isNull(accountDeletionRequests.completedAt),
      ),
    )
    .limit(1)
  return row
}

export async function handleFacebookDataDeletion(
  args: Args,
): Promise<Result<FacebookDataDeletionResponse, ValidationError>> {
  const payload = verifyAndDecodeSignedRequest(args.signedRequest, args.appSecret)
  if (!payload) {
    return err(new ValidationError('invalid signed_request'))
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

  const existing = await findActiveRequest(appUserId)
  if (existing) {
    return ok({
      url: buildStatusUrl(args.statusUrlBase, existing.confirmationCode),
      confirmationCode: existing.confirmationCode,
    })
  }

  const scheduledFor = new Date(Date.now() + env.ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)
  const confirmationCode = generateConfirmationCode()
  await db.insert(accountDeletionRequests).values({
    userId: appUserId,
    scheduledFor,
    source: 'facebook',
    confirmationCode,
  })

  return ok({ url: buildStatusUrl(args.statusUrlBase, confirmationCode), confirmationCode })
}

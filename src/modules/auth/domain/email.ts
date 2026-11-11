import { z } from 'zod'

/**
 * An email address as every auth endpoint accepts it. RFC 5321 caps a
 * forward path at 254 characters; longer input is never a deliverable
 * address, and accepting it would let a caller write arbitrarily large
 * per-email rate-limit keys.
 */
export const EmailSchema = z.email().max(254)

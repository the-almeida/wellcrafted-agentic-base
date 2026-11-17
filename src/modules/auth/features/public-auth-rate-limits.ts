import { rateLimit, rateLimitKey } from '@/shared/lib/rate-limit'

/**
 * The rate limits every public auth action applies before calling the
 * provider: per IP first, then per email.
 *
 * The order matters. A call refused by the IP limit must not count against
 * the email: otherwise one attacker IP, already over its own limit, could
 * keep spending a victim's email budget and lock that email out for
 * everyone, the victim included.
 */
export async function limitPublicAuthCall(
  endpoint: string,
  { ip, email }: { ip: string; email: string },
  limits: { perIp: number; perEmail: number },
) {
  const windowMs = 60_000
  const ipLimit = await rateLimit(`${endpoint}:ip:${ip}`, { windowMs, max: limits.perIp })
  if (!ipLimit.ok) return ipLimit
  return rateLimit(rateLimitKey(endpoint, 'email', email), { windowMs, max: limits.perEmail })
}

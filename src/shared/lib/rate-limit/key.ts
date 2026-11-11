import type { RateLimitKey } from './limiter'

export type RateLimitSubject = 'email' | 'ip' | 'user'

/**
 * Builds the key `<endpoint>:<subject>:<value>`.
 *
 * Email addresses are trimmed and lowercased first. Supabase treats them
 * case-insensitively, so without this every capitalization of one address
 * (`Fulano@x.com`, `FULANO@x.com`, ...) would get its own bucket while all of
 * them hit the same account, defeating the per-email limit.
 */
export function rateLimitKey(
  endpoint: string,
  subject: RateLimitSubject,
  value: string,
): RateLimitKey {
  const normalized = subject === 'email' ? value.trim().toLowerCase() : value
  return `${endpoint}:${subject}:${normalized}`
}

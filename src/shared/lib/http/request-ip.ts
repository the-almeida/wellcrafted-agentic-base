import { headers } from 'next/headers'

/**
 * Best-effort client IP extraction.
 *
 * Behind Vercel (and most reverse proxies), `x-forwarded-for` carries
 * the chain of IPs from client → edge → origin. The first entry is
 * the real client; subsequent entries are intermediaries we don't
 * care about. `x-real-ip` is the same data without the chain — some
 * proxies set one and not the other.
 *
 * When neither header is set (local `pnpm dev` with no proxy in
 * front), we return `'unknown'`. This means all such traffic shares
 * one rate-limit bucket, which is fine for a dev environment.
 */
export function extractIpFromHeaders(h: Headers): string {
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = h.get('x-real-ip')?.trim()
  if (real) return real
  return 'unknown'
}

export async function getRequestIp(): Promise<string> {
  const h = await headers()
  return extractIpFromHeaders(h)
}

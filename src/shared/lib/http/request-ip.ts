import { headers } from 'next/headers'

/**
 * Client IP for rate-limit keys. Only trustworthy on Vercel.
 *
 * Vercel overwrites `x-forwarded-for` with the client's public IP to
 * prevent spoofing, and sets `x-vercel-forwarded-for` to the same value,
 * which a proxy placed in front of Vercel cannot rewrite. Source:
 * https://vercel.com/docs/headers/request-headers (page dated 2025-12-13,
 * checked 2026-11-12). With such a proxy, Vercel likely sees the proxy's
 * IP, so per-IP limits collapse into one bucket.
 *
 * `x-vercel-forwarded-for` is read only when `VERCEL=1` (a Vercel system
 * env var): elsewhere a client can send it, and a proxy that correctly
 * overwrites `x-forwarded-for` would not strip it. Off Vercel, every
 * header here is only as trustworthy as the proxy in front: one that
 * appends to `x-forwarded-for` lets a client forge a new IP per request.
 *
 * When no header is set (local `pnpm dev`), we return `'unknown'`, so all
 * such traffic shares one rate-limit bucket.
 */
export function extractIpFromHeaders(h: Headers): string {
  const vercel = process.env.VERCEL === '1' ? h.get('x-vercel-forwarded-for') : null
  if (vercel) return vercel
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

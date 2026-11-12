import { afterEach, describe, expect, it, vi } from 'vitest'

import { extractIpFromHeaders } from './request-ip'

function headers(record: Record<string, string>): Headers {
  return new Headers(record)
}

describe('extractIpFromHeaders', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('ignores x-vercel-forwarded-for off Vercel, where a client can forge it', () => {
    vi.stubEnv('VERCEL', undefined)
    expect(
      extractIpFromHeaders(
        headers({ 'x-vercel-forwarded-for': '6.6.6.6', 'x-forwarded-for': '203.0.113.30' }),
      ),
    ).toBe('203.0.113.30')
  })

  it('on Vercel, prefers x-vercel-forwarded-for when an upstream proxy rewrote x-forwarded-for', () => {
    vi.stubEnv('VERCEL', '1')
    expect(
      extractIpFromHeaders(
        headers({ 'x-vercel-forwarded-for': '203.0.113.20', 'x-forwarded-for': '6.6.6.6' }),
      ),
    ).toBe('203.0.113.20')
  })

  it('on Vercel, falls back to x-forwarded-for when x-vercel-forwarded-for is blank', () => {
    vi.stubEnv('VERCEL', '1')
    expect(
      extractIpFromHeaders(
        headers({ 'x-vercel-forwarded-for': '   ', 'x-forwarded-for': '203.0.113.1' }),
      ),
    ).toBe('203.0.113.1')
  })

  it('returns the first entry from x-forwarded-for', () => {
    expect(
      extractIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.1, 10.0.0.2, 10.0.0.3' })),
    ).toBe('203.0.113.1')
  })

  it('trims whitespace around the first x-forwarded-for entry', () => {
    expect(
      extractIpFromHeaders(headers({ 'x-forwarded-for': '   203.0.113.5   , 10.0.0.1' })),
    ).toBe('203.0.113.5')
  })

  it('handles a single-entry x-forwarded-for', () => {
    expect(extractIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(extractIpFromHeaders(headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4')
  })

  it('prefers x-forwarded-for over x-real-ip when both are set', () => {
    expect(
      extractIpFromHeaders(
        headers({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '198.51.100.4' }),
      ),
    ).toBe('203.0.113.9')
  })

  it("returns 'unknown' when neither header is set", () => {
    expect(extractIpFromHeaders(headers({}))).toBe('unknown')
  })

  it("returns 'unknown' when x-forwarded-for is empty or whitespace", () => {
    expect(extractIpFromHeaders(headers({ 'x-forwarded-for': '' }))).toBe('unknown')
    expect(extractIpFromHeaders(headers({ 'x-forwarded-for': '   ' }))).toBe('unknown')
  })
})

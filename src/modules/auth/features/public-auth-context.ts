import type { AuthProvider } from '../ports/auth-provider'

/**
 * What a public auth action (no session yet) needs from its caller: the
 * auth provider to call and the client IP for per-IP rate limits. The
 * handler passes the real ones (`authProvider`, `getRequestIp()`); tests
 * pass the contract-checked fake and an IP of their own.
 */
export type PublicAuthContext = {
  authProvider: AuthProvider
  ip: string
}

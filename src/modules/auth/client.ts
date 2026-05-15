/**
 * Auth Module — client-facing surface.
 *
 * Client Components import from `@/modules/auth/client` (this file).
 * Server Components and middleware import from `@/modules/auth` (index.ts).
 *
 * The split exists because Next.js bundles imports through a barrel even
 * when only one named export is used. Mixing server-only utilities (which
 * touch `next/headers`, the DB, Pino, etc.) with client-callable helpers
 * in one barrel pulls the server-only deps into the client bundle and
 * breaks the build. The two-file split keeps the dependency graphs clean.
 *
 * Server actions live in their own `'use server'` handler files, which is
 * the actual RPC boundary; re-exporting them here lets the boundaries
 * plugin treat them as imports through a module's public surface.
 */

export type { Role, User } from './domain/user'

export { createSupabaseBrowserClient } from './adapters/supabase/browser-client'

export { requestSignInOtp } from './features/request-sign-in-otp/request-sign-in-otp.handler'
export { requestSignUpOtp } from './features/request-sign-up-otp/request-sign-up-otp.handler'
export { signIn } from './features/sign-in/sign-in.handler'
export { signOut } from './features/sign-out/sign-out.handler'
export { signUp } from './features/sign-up/sign-up.handler'
export { verifyOtp } from './features/verify-otp/verify-otp.handler'

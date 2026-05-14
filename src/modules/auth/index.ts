/**
 * Auth Module — server surface.
 *
 * Server Components, Server Actions, Route Handlers, and middleware import
 * from `@/modules/auth` (this file). Client Components import from
 * `@/modules/auth/client` (see `./client.ts`).
 *
 * Owns identity primitives and the cross-module authorization contract:
 * `User`, `Role`, `requireUser`, `getOptionalUser`, `isAdmin`, and the
 * `Policy<T>` generic type that other modules implement.
 *
 * Auth has NO knowledge of any other module's actions. Each module that
 * performs authorization declares its own `Action` union and exports an
 * instance of `Policy<TAction>` from its `domain/policy.ts`.
 *
 * Error classes (UnauthenticatedError, ForbiddenError, etc.) are NOT
 * re-exported from here. Consumers import them directly from
 * `@/shared/lib/errors/base`.
 *
 * Three Supabase clients (server, browser, middleware) live under
 * `adapters/supabase/`. Session refresh happens in middleware via
 * `updateSession`. Always use `getUser()` for auth checks; `getSession()`
 * is unsafe (banned by lint).
 */

export type { Policy } from './domain/policy'
export { isAdmin } from './domain/policy'
export type { Role, User } from './domain/user'

export { getOptionalUser } from './get-optional-user'
export { requireUser } from './require-user'

export { updateSession } from './adapters/supabase/update-session'

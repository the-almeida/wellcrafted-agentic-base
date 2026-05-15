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
export { requireUser, requireUserAllowPendingDeletion } from './require-user'

export { updateSession } from './adapters/supabase/update-session'

export { cancelAccountDeletion } from './features/account-deletion/cancel-account-deletion.handler'
export { handleFacebookDataDeletion } from './features/account-deletion/facebook-data-deletion'
export { findDeletionRequestByCode } from './features/account-deletion/find-deletion-request-by-code'
export { getActiveDeletionRequest } from './features/account-deletion/get-active-deletion-request'
export { requestAccountDeletion } from './features/account-deletion/request-account-deletion.handler'
export {
  ACCOUNT_HOME_PATH,
  PENDING_DELETION_PATH,
  resolveProtectedRouteRedirect,
} from './features/account-deletion/resolve-protected-redirect'

export { exchangeOauthCode } from './features/oauth-callback/oauth-callback.handler'
export { oauthCallbackInputSchema } from './features/oauth-callback/oauth-callback.schema'

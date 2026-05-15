# Claude Operating Manual

## Project context

`wellcrafted-agentic-base` is a production-ready Next.js boilerplate engineered for agentic coding with high quality standards. It is meant to be forked as the foundation for new projects.

Stack: Next.js (App Router), TypeScript, Drizzle, Supabase (`@supabase/ssr`), Zod, Vitest, Playwright, Pino, Sentry, PostHog, Tailwind, shadcn/ui.

## Required workflow

Every non-trivial change follows this flow:

1. `/grill` — adversarial alignment. Updates `CONTEXT.md` inline as terms are resolved. Offers ADR if the decision is hard-to-reverse, surprising, and the result of a real tradeoff.
2. List behaviors — happy path + edge + adversarial + security. The user approves the list before any code is written.
3. `/tdd` — vertical slice red-green-refactor. One behavior at a time. RED is observed (test runs and fails) before GREEN.
4. Refactor pass with everything green.
5. `/review` — self-review against the Definition of Done.
6. `/commit` — runs review internally, generates conventional commit, asks for confirmation.

Trivial changes (typo, comment, formatting) skip the flow.

## Non-negotiable principles

- KISS, YAGNI, Rule of Three before abstracting
- DRY about knowledge, not about code that looks similar
- Boring code > clever code
- Explicit > implicit
- Result types for expected errors. Throw only for true bugs
- Branded types for IDs, constructed only via Zod schemas
- Composition > inheritance
- Discriminated unions > class hierarchies

## Forbidden

- `utils/` or `common/` folder names (use `shared/lib/<category>/`)
- Loose files in `shared/lib/` (always inside a category subfolder)
- Cross-module direct imports (only via `index.ts` public API)
- Circular dependencies
- Business logic in RLS (RLS is ownership-only defense-in-depth)
- Side effects in import
- Mutable singletons
- `--no-verify` on commits or pushes
- `@apply` in CSS
- Custom-built modal/dropdown/combobox (always wrap shadcn primitives)
- Free-cast branded type constructors
- `supabase.auth.getSession()` for authorization (use `getUser()`)
- `export const runtime = 'edge'` anywhere (enforced by `check-no-edge.sh`)

## Architecture summary

Modular Monolith + Vertical Slice + Hexagonal (ports & adapters).

- `src/modules/<domain>/features/<feature>/` — vertical slices (handler + schema + logic + test)
- `src/modules/<domain>/domain/` — entities, value objects, pure rules. Optional, only when invariants exist
- `src/modules/<domain>/domain/policy.ts` — per-module authorization policy. Required when the module has handlers that perform auth checks
- `src/modules/<domain>/ports/` and `adapters/` — only when external dependencies exist
- `src/modules/<domain>/index.ts` — only public API
- Cross-module via `index.ts` only. Boundaries enforced by `eslint-plugin-boundaries`

Full architecture in [docs/architecture.md](./docs/architecture.md).

## Error handling

- Server actions wrapped with `withErrorBoundary` from `@/shared/lib/errors/with-error-boundary` (Sentry does not auto-instrument server actions)
- Route handlers and Server Components: NOT wrapped (auto-captured via `instrumentation.ts`)
- `Result<T, E>` for expected errors. Throw only for bugs

## Authorization

- Auth module exposes `requireUser`, `getOptionalUser`, `isAdmin`, `Policy<T>` type, `updateSession`. It does not know other modules' actions
- Each module declares its own `Action` union and `Policy` instance in `domain/policy.ts`
- Server Actions and Route Handlers MUST call the relevant module's policy before any work
- The entity passed to a policy MUST come from the database, never from client input
- `isAdmin(user)` is for use INSIDE module policies, not as a shortcut to skip them
- Error classes are imported directly from `@/shared/lib/errors/base`. The auth module does NOT re-export them
- RLS is defense-in-depth only (ownership by `user_id`); the backend bypasses via service role

## Server Actions vs Route Handlers

- Server Actions (`'use server'`): default for internal mutations from the app. Wrapped in `withErrorBoundary`
- Route Handlers (`app/api/<route>/route.ts`): for webhooks, external consumers, streaming. Files are thin and delegate to module functions

## Database

- Drizzle is the source of truth for schema (`src/shared/db/schema/`)
- Schema columns use `.$type<BrandedId>()` so query results are branded directly
- Supabase CLI manages RLS policies, triggers, functions
- Backend uses service role key (bypasses RLS)
- Never write SQL via string concatenation; always Drizzle

## Validation

- Zod schemas at every external boundary
- Same schema on client and server (no duplication)
- Branded ID types are constructed only via Zod brand schemas (`UserIdSchema.parse(x)`); never via free casts

## Auth (Supabase SSR)

- Three Supabase clients: server (`next/headers`), browser, and proxy (used by `src/proxy.ts` for request/response cookie flow — Supabase's term for this client is still "middleware-client"). All under `src/modules/auth/adapters/supabase/`
- Session refresh happens in the proxy (`src/proxy.ts`, Next 16's renamed middleware) via `updateSession`. Server Components cannot write cookies
- Always use `getUser()` for authorization checks. `getSession()` is not safe (reads unverified cookies)
- The proxy does NOT enforce auth. It refreshes sessions and adds request IDs. Auth enforcement is per-page/per-handler via `requireUser` (or in a route group layout)
- Authenticated pages must be dynamic: `export const dynamic = 'force-dynamic'` or rely on Server Actions/Route Handlers (which are dynamic by default)
- OAuth: email, Google, Facebook

## Observability

- Logger (Pino) auto-injects `requestId` from `AsyncLocalStorage` context. Pino is Node-only; Edge is forbidden across the project (`check-no-edge.sh`)
- The proxy (`src/proxy.ts`) always runs on Node in Next 16 (no `runtime` export needed) so logging and ALS work
- PII redacted by default in Pino. Correlate via `userId` only
- `instrumentation.ts` registers Sentry's `onRequestError` hook for auto-capture in route handlers and server components
- Sentry's `sendDefaultPii` is `false`. Attach `Sentry.setUser({ id: userId })` explicitly when needed; never email/name/phone
- PostHog has NO autocapture. Events are intentional, declared in `events.ts` + `schemas.ts`
- `trackExpectedError(err, feature)` is available for opt-in error-rate visibility on specific handlers. Do not auto-call for every Result error

## Product analytics

- Track via `track()` (server) or `track.client()` (browser) from `@/shared/observability/analytics`
- Adding an event requires entries in `events.ts` and `schemas.ts`
- Naming: snake_case, past-tense verbs (`user_signed_up`)
- No PII in payloads
- Server-side for critical events (signup, purchase). Client-side for UX (interactions)
- Before adding an event, ask: "what product decision does this answer?" If none, do not track
- For error-rate visibility on a specific handler, call `trackExpectedError(err, 'feature_name')` from `@/shared/lib/errors/track-expected`. Use sparingly; not every Result error needs to be tracked

## Security

For every implementation verify:

- Input validated with Zod at the boundary
- Authorization via the module's `Policy` before any work, with the entity loaded from DB
- SQL via Drizzle only (never string concat)
- Secrets via the validated `env` module
- No PII in logs (logger redacts; do not bypass)
- Server actions wrapped with `withErrorBoundary`
- `getUser()`, never `getSession()` for auth checks

For changes touching auth, authorization, payments, or PII handling: invoke `@security-auditor` before opening a PR.

## Tailwind and UI

- Tailwind v4 — config lives in CSS via `@theme` + `@custom-variant dark` in `src/app/globals.css`. No `tailwind.config.ts`
- Dark mode is the default, light is opt-in; the root layout adds `className="dark"` to `<html>` and `next-themes` swaps the class
- Componentize when classes exceed ~6-8 utilities
- Use `cn()` from `@/shared/lib/cn`
- Use `cva` for component variants
- No `@apply`, no inline hex codes
- All interactive components are shadcn primitives wrapped in `src/shared/ui/`. Never build custom Dialog, Dropdown, Combobox, etc.

## Files

- File size soft limit: 300 lines. Split when exceeded
- Tests co-located: `<file>.test.ts` (unit) or `<file>.integration.test.ts` (integration)
- E2E tests live in `/e2e/`

## Commands

- `pnpm dev` — start app (auto-starts Supabase)
- `pnpm test` / `pnpm test:watch` — run all tests
- `pnpm e2e` — smoke e2e
- `pnpm e2e:full` — full e2e
- `pnpm typecheck`
- `pnpm lint`
- `pnpm db:generate` — generate Drizzle migration from schema diff
- `pnpm db:migrate` — apply migrations

## Definition of Done

See [docs/dod.md](./docs/dod.md). `/review` and `/commit` validate against this checklist.

## Gotchas

- The dev server expects Supabase CLI to be running. `pnpm dev` starts it automatically; check status with `pnpm supabase:status` if something feels off.
- Edge runtime is forbidden project-wide (`scripts/check-no-edge.sh` enforces). Pino, ALS, and `node:crypto` all require Node.
- Adding a table that needs RLS requires two SQL files in the same commit, both under `supabase/migrations/`: the Drizzle-generated `CREATE TABLE` (via `pnpm db:generate`) and the hand-authored RLS / trigger SQL (via `supabase migration new`). Supabase CLI applies the folder as one timestamp-ordered sequence. Run `supabase db reset` locally to verify the whole sequence applies cleanly. See ADR-0003.

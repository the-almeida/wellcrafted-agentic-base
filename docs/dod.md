# Definition of Done

A feature or fix is done when ALL of these are true:

## Behavior

- [ ] Behaviors listed and approved by user (happy + edge + adversarial + security)
- [ ] Each behavior has a passing test (RED was observed before GREEN)
- [ ] No test was simplified or removed to make implementation easier
- [ ] Refactor pass completed with everything green

## Code quality

- [ ] `pnpm lint` clean
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test --run` green
- [ ] `pnpm e2e` green (smoke)
- [ ] `eslint-plugin-boundaries` clean (no cross-module direct imports)
- [ ] `./scripts/check-policies.sh` clean (every module whose features call `requireUser` has `domain/policy.ts`; `auth` is exempt)
- [ ] No file >300 lines (or has explicit justification)
- [ ] No `utils/` or `common/` folders created
- [ ] No commented-out code

## Architecture

- [ ] Module boundaries respected (cross-module via `index.ts` or `client.ts` only)
- [ ] New ports only with a second implementation or a contract-checked fake (ADR-0007)
- [ ] Domain logic free of infra (no SDK imports in `domain/`)
- [ ] No business logic in RLS policies

## Errors

- [ ] Server actions wrapped with `withErrorBoundary`
- [ ] Route handlers NOT wrapped (relies on `instrumentation.ts` auto-capture)
- [ ] Expected errors via `Result<T, E>`, not throw
- [ ] Validation at boundary (Zod schemas)
- [ ] Error messages do not leak PII or internals

## Security

- [ ] Module's `Policy` called before any work in handlers
- [ ] Entity passed to policy comes from DB, not from client input
- [ ] Input validated with Zod
- [ ] Branded IDs constructed only via Zod schemas (no free casts)
- [ ] `getUser()` (not `getSession()`) used for auth checks
- [ ] SQL via Drizzle only (no string concat)
- [ ] Secrets via the validated `env` module
- [ ] No PII in logs
- [ ] Public endpoints (anonymous-callable) are rate-limited
- [ ] `@wc-security-auditor` invoked for changes touching auth, authorization, payments, or PII

## Migrations

- [ ] If a new table was added, both the Drizzle-generated migration AND the hand-authored RLS migration are present (both live in `supabase/migrations/`)
- [ ] `supabase db reset` runs cleanly locally before pushing (re-applies the full sequence)

## Observability

- [ ] New events follow schema (entries in `events.ts` and `schemas.ts`)
- [ ] Logs include `requestId` (automatic via context)
- [ ] No Pino imports from Edge-runtime code

## Accessibility

- [ ] `eslint-plugin-jsx-a11y` violations: zero
- [ ] New pages or components covered by axe-core smoke check
- [ ] Interactive components use shadcn primitives

## Process

- [ ] Conventional commit message via `/wc-commit`
- [ ] `CONTEXT.md` updated if a new domain term was introduced
- [ ] ADR added if the decision is hard-to-reverse, surprising, AND a real tradeoff

## Release checklist (auth)

OAuth providers cannot be exercised in CI — Google and Facebook both rate-limit unattended traffic, require real user accounts, and are flaky under headless 2FA. The integration and e2e suites cover the parts of OAuth we own (input validation, the `exchangeCodeForSession` path, the same-origin `next` redirect). The provider round-trip itself must be smoked manually before any production deploy that touches auth.

- [ ] Real Google sign-in against staging completes and lands the user on `/dashboard` with `public.users.name` populated from the Google profile
- [ ] Real Facebook sign-in against staging completes the same flow. If the user denies the `public_profile` scope during sign-up, the `NOT NULL` on `public.users.name` rejects the new user and the app redirects back to `/sign-up?error=oauth_failed`, where the `AuthErrorBanner` hint about granting the profile permission is visible
- [ ] Both providers' redirect URIs in the provider consoles point at Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`), and the Supabase redirect allow-list covers the app callback (`https://<host>/auth/callback`). See [deployment.md](./deployment.md#7-oauth-providers-optional)
- [ ] If `GOOGLE_OAUTH_*` / `FACEBOOK_OAUTH_*` env vars changed, the Supabase project's auth settings reflect them

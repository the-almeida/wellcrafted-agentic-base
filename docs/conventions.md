# Conventions

## Files

- `kebab-case.ts` for files
- `PascalCase.tsx` for React components
- One default export per file when it represents the file's main concern
- File size soft limit: 300 lines. Split when crossed

## Naming

- Variables and functions: `camelCase`
- Types and Interfaces: `PascalCase`
- Top-level immutable constants: `SCREAMING_SNAKE_CASE`
- Booleans: prefix `is`, `has`, `should`, `can`
- Functions returning `Result`: no `try` prefix; the return type tells

## Imports

- Order: external → `@/shared` → `@/modules` → relative
- Cross-module: only via `<module>/index.ts`
- No barrel files except module `index.ts` (kills tree-shaking)

## Tests

- Co-located: `foo.ts` + `foo.test.ts` (unit) or `foo.integration.test.ts` (integration)
- E2E tests in `/e2e/`
- Test name describes behavior, not implementation
- Reads like a spec: "user can sign in with valid credentials"

## Test quality

A test is a falsifiable claim about behavior. If no realistic bug could flip it from green to red, it is decoration, not protection. This section is the project's canon on what makes a test load-bearing; `@wc-test-auditor` enforces it after each GREEN cycle of `/wc-tdd`.

### Principles

The agent reads from these principles directly; the checklist below is illustrative, not a substitute for judgment.

1. **Falsifiable.** Before writing a test, name a one-line change to the code being tested that this test would catch. If you can't, do not write the test.
2. **Caller's language.** Tests describe behavior at the public interface (HTTP, Server Action, exported function, rendered UI). Internal names, private functions, or private state in a test name or assertion is a signal the test is brittle and will break on refactor.
3. **One diagnostic reason to fail.** A failing test should point at one behavior. If a test can fail for three unrelated reasons, split it.
4. **Every line earns its place.** Setup, action, and assertion lines must each be load-bearing for the behavior being tested. A fixture value that the code under test never reads, a `fill` that satisfies validation the action does not trigger, a header that no handler inspects — these are evasive lines (see `CONTEXT.md`).
5. **Specific to regressions, robust to refactor.** Assertions narrow enough that a real regression breaks them, wide enough that legitimate refactors don't. `.toBeTruthy()` rarely passes the first half; full-DOM snapshots rarely pass the second.
6. **Passes for the right reason.** Green is necessary, not sufficient. Verify the code path implied by the test was actually exercised. The RED failure message is the primary cross-check: GREEN must resolve the same reason RED failed.
7. **I/O sources are controlled.** Time, randomness, and external state are the three flake sources. `waitForTimeout` used as a substitute for waiting on a deterministic ready signal is a band-aid that ages into a flake.
8. **Cost-of-change lives in production code, not tests.** If a test forced you to add a flag, field, or branch the production code didn't otherwise need, the test design is suspect. Tests describe consumer-facing behavior; if no consumer needs the new flag, the test invented a fake consumer.

### Evasive-test patterns

These are the concrete patterns `@wc-test-auditor` flags. Each violates one or more principles above. The heuristic ID is the value used in `// @wc-test-auditor-allow: <id> — <reason>` overrides.

| ID                    | Pattern                                                                                                                                                               | Principle |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `setup-not-justified` | Setup line whose value never appears in the action or the assertion. The line was added to get past something that turned out not to block the test.                  | 4         |
| `red-green-mismatch`  | GREEN passes but the code path the test claims to exercise is not actually touched by the GREEN diff. Test is green for an unrelated reason.                          | 6         |
| `noop-negative`       | `toHaveCount(0)` / `.not.toBeVisible()` on a selector that has never rendered in any prior state of this test. The negative assertion was never going to fail anyway. | 1         |
| `wide-mouth`          | `.toBeTruthy()`, `.toBeDefined()`, `expect(spy).toHaveBeenCalled()` with no arg-shape check, `.resolves` without a value check. Asserts something is "anything."      | 5         |
| `swallowed-failure`   | `try/catch` in test body, `.catch(() => {})`, `expect(...).rejects` without an error-shape assertion. The failure path is hidden from the test runner.                | 3         |
| `internal-mock`       | Mocking the code being tested or its internal (non-port) collaborator. (Already a hard rule in `/wc-tdd`; the agent re-verifies by reading code.)                     | 2         |
| `sleep-band-aid`      | `waitForTimeout` used to wait for state that has a deterministic ready signal.                                                                                        | 7         |
| `assertion-on-bug`    | Assertion text comes from a known error/regression path rather than a positive spec. Fixing the regression makes the assertion silently true.                         | 1         |
| `skip-or-only`        | `.skip` / `.only` / `xit` / `fit` left in the test file.                                                                                                              | —         |

### Worked example: the OTP dummy-password case

The canonical evasive test in this repo (now fixed) lived in `e2e/full/auth-otp.spec.ts`:

```ts
await page.goto('/sign-in')
await page.getByLabel('Email').fill(email)
// Password is required by HTML; fill a dummy so the form validates
// through to the OTP button without blocking on `required`.
await page.getByLabel('Password').fill('not-used-for-otp-flow')
await page.getByRole('button', { name: 'Or send me a 6-digit code instead' }).click()
```

The comment is a confident, plausible-sounding diagnosis. It is also wrong. The OTP button is declared `type="button"` in `sign-in-form.tsx`, so clicking it never triggers HTML5 form validation. The password fill is solving a problem that does not exist. The two sibling OTP tests in the same file don't fill the password field and pass fine — that was the cross-check that should have flipped a yellow flag, but didn't.

This is `setup-not-justified` (principle 4): a value the form never reads. It also illustrates a broader failure mode worth naming explicitly: **a workaround for a misdiagnosed problem ossifies behind a confident comment**. When you find yourself writing a comment that explains why a test step is necessary, delete the step and re-run. If the test still passes, the step was evasive.

The fix was deleting the lines, no production change required.

### Procedural integration

`/wc-tdd` invokes `@wc-test-auditor` automatically after each GREEN. The agent receives:

- the changed test file(s);
- the captured RED failure output from the cycle just completed;
- the GREEN diff of code under test (files touched between RED and GREEN).

It returns a binary `pass | fail` verdict with structured findings. On `fail`, `/wc-tdd` halts the current cycle.

Resolve by either:

- **Editing the test** to remove the evasion (preferred), then re-running RED → GREEN → `@wc-test-auditor`; or
- **Adding an inline override** on the relevant line:

  ```ts
  // @wc-test-auditor-allow: <heuristic-id> — <reason>
  ```

  The override is per-finding (per heuristic ID), not per-test — other heuristics still run on the same lines. The reason must be specific and verifiable, e.g. `// @wc-test-auditor-allow: setup-not-justified — header read by middleware request-id tracing, not by the handler`. A vague reason ("not applicable", "fine", "needed for the test") is itself a finding.

The annotation is the audit log. It lives in the diff and is reviewed in the PR. There is no separate override file.

## Conventional commits

```
<type>(<scope>): <short description>

<body explaining why, not what>

<footer with breaking changes or refs>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `build`, `ci`.

Scope when meaningful (module name): `feat(auth): add magic link sign-in`.

## Result types

- Use `Result<T, E>` for expected errors (validation, not-found, forbidden)
- Throw only for true bugs (programmer errors, invariants violated)

## Branded types

- IDs are branded via Zod (`z.uuid().brand<'UserId'>()`) and never constructed via free casts
- Drizzle columns annotate `.$type<BrandedId>()` so query results come out branded
- The two construction paths are: Zod parse at boundaries, Drizzle annotation for trusted internal data

## Authorization

- Auth module owns `requireUser`, `isAdmin`, `Policy<T>` type
- Each module that has handlers needing auth checks declares its own `Action` union and `Policy` instance in `domain/policy.ts`
- Handler order: `requireUser` → input validation → load entity from DB → call module policy → perform work
- The entity passed to the policy must come from the DB, never from client input
- Always `supabase.auth.getUser()` for auth checks. `getSession()` is forbidden for authorization (it does not verify the token)

## Pages and dynamic rendering

- Authenticated pages: either rely on Server Actions/Route Handlers (always dynamic), or set `export const dynamic = 'force-dynamic'`. Static or ISR-cached pages can leak `Set-Cookie` headers across users when sessions refresh
- The proxy (`src/proxy.ts`, Next 16's renamed middleware) runs on Node runtime. Do not import Pino, ALS, or `node:crypto` from Edge-runtime code

## Comments

- Avoid comments. Code should be self-explanatory
- Comment only when strictly necessary: non-obvious why, workarounds for external bugs, regulatory requirements
- Code says what, comments say why (when they exist)
- No commented-out code in commits

## Tailwind (v4)

- Config lives in `src/app/globals.css` via `@import 'tailwindcss'` + `@theme` + `@custom-variant dark`. No `tailwind.config.ts` file
- Componentize when an element exceeds ~6-8 utility classes
- Use `cn()` from `@/shared/lib/cn`
- Use `cva` for component variants
- No `@apply` in CSS files
- No inline hex codes (use design tokens in `@theme inline { ... }`)
- Always wrap shadcn primitives for interactive components; never build custom Dialog, Dropdown, Combobox
- Dark mode is the default (root `<html className="dark">`); `next-themes` swaps the class on user toggle

## Rate limiting

Public endpoints (sign-in, sign-up, password reset, webhook receivers, anything callable by anonymous users) MUST be rate-limited before going to production.

- Per-IP and per-email limits where applicable; per-IP alone lets one bot saturate a single email's bucket, per-email alone lets an attacker scrape by varying emails. Wire both
- Build email keys with `rateLimitKey(endpoint, 'email', email)`. It trims and lowercases the address; without that, every capitalization of one address gets its own bucket while all of them reach the same Supabase account
- Supabase Auth's built-in limits are not a per-user backstop here. Server actions call Supabase from the server, so Supabase sees the server's IP and its "per IP" limits apply to the whole app at once. New public endpoints that don't touch Supabase have no protection besides ours
- `rateLimit` is defense against abuse, not authorization. When Redis is unavailable it fails open: the call proceeds, and the failure goes to `logger.error` and Sentry (the key is left out, since it can contain an email). The Redis client uses a 1s timeout and a single retry, so an outage costs at most about two seconds per call

### Backends

- **Redis** when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are both set. The `env` module rejects one without the other, because silently falling back to memory would multiply every limit by the number of instances. The client is `@upstash/redis` (Vercel deprecated `@vercel/kv`), so any Upstash-compatible REST endpoint works
- **In memory** when neither is set. Counters reset on restart and are not shared across instances: fine for local dev and single-instance deploys, not safe for multi-instance production. A warning is logged on first use
- Counting is a fixed window, done in one Lua script so a counter can never be left without an expiry. A counter found without one (left by older code) gets an expiry on its next call

### Deploying to Vercel

1. Storage → Marketplace → pick a Redis offering (for example Upstash) and connect it to the project. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`
2. Redeploy. The warning about in-memory rate limiting disappears from the logs

### Tests

- The same contract suite runs against both backends (`src/shared/lib/rate-limit/contract.test-helper.ts`). The Redis run uses a real Redis behind `serverless-redis-http`, which speaks the Upstash REST API, from `docker-compose.yml`
- `pnpm dev`, `pnpm bootstrap` and CI run `docker compose up -d`. Without it the Redis tests fail with a message saying so; they are never skipped
- The DoD verifies rate limiting on new public endpoints

## OAuth providers

A provider (Google, Facebook) is **active** when its client id is set in the app's environment (`GOOGLE_OAUTH_CLIENT_ID`, `FACEBOOK_OAUTH_CLIENT_ID`). Only active providers get a button on the sign-in and sign-up pages; with none active, the buttons and the "or" divider disappear. Client ids are public (they show up in the provider's redirect URL), so putting them in the app's environment exposes nothing.

Supabase Auth must have exactly the same providers enabled. The app cannot set that for you: locally it lives in `supabase/config.toml` (`enabled` does not accept `env()`; the CLI rejects it in boolean fields), and in production in the Supabase dashboard (Authentication → Providers).

`pnpm build` runs `pnpm check:oauth-providers` first. It reads Supabase Auth's public `GET /auth/v1/settings` with the anon key and fails the build, everywhere (locally, in CI and on deploys), when:

- a supported provider is enabled in Supabase but not active in the app, or the other way round;
- any other OAuth provider is enabled in Supabase. The app has no button for it, but anyone can still use it by calling Supabase directly with the public anon key;
- Supabase cannot be asked (not running, wrong URL or anon key, or an answer that is not the settings).

Email, phone and anonymous sign-ins are not part of this check.

The check runs at build time only. A provider enabled in the Supabase dashboard after a deploy goes unnoticed until the next build, so change providers through a deploy, not just in the dashboard.

To enable a provider:

1. Register the app with the provider. The redirect URI is `<SUPABASE_URL>/auth/v1/callback`.
2. Locally: set its client id and secret in `.env.local`, set `enabled = true` in `supabase/config.toml`, and restart Supabase (`pnpm exec supabase stop && pnpm exec supabase start`); the CLI reads `.env.local` only on start.
3. In production: enable the provider in the Supabase dashboard with the same client id and secret, and set the client id in the deploy environment.

## Auth: accepted trade-offs

These are deliberate choices the boilerplate makes that a downstream project may want to revisit:

- **Account enumeration via OTP sign-in.** When a user requests an OTP code for an unregistered email, `requestSignInOtp` returns a specific Supabase error ("Signups not allowed for otp") that the form surfaces verbatim. An attacker can probe which emails are registered by reading this response. We accept this because (1) precise error UX helps the common case of typo'd emails, and (2) for the boilerplate's low-stakes default audience, enumeration isn't a primary threat. **If your project handles sensitive accounts (financial, medical, social-graph, anything where "X has an account here" is itself confidential), normalize `requestSignInOtp` to always return `ok(undefined)` and show a generic "If an account exists, we sent a code" message.** Per-IP rate limiting (already in place) blunts mass enumeration but does not eliminate it.

## Accessibility

- All components must pass `eslint-plugin-jsx-a11y` rules
- Smoke e2e tests verify A11y via `@axe-core/playwright`
- Use semantic HTML (`<main>`, `<nav>`, `<article>`)
- All form fields have associated labels
- All images have meaningful `alt` (or `alt=""` if decorative)

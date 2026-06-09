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
- Supabase Auth provides built-in rate limiting on its endpoints; the scaffold's auth flows benefit from that automatically. New public endpoints do NOT inherit this protection
- `src/shared/lib/rate-limit/` ships a working implementation: Vercel Marketplace Redis when `KV_REST_API_URL`/`KV_REST_API_TOKEN` are set (auto-injected by Vercel when you provision a Redis store), otherwise an in-memory fallback that warns once on startup. The in-memory backend resets on restart and doesn't share state across replicas — fine for local dev, not safe for multi-instance production
- The DoD verifies rate limiting on new public endpoints

## Auth: accepted trade-offs

These are deliberate choices the boilerplate makes that a downstream project may want to revisit:

- **Account enumeration via OTP sign-in.** When a user requests an OTP code for an unregistered email, `requestSignInOtp` returns a specific Supabase error ("Signups not allowed for otp") that the form surfaces verbatim. An attacker can probe which emails are registered by reading this response. We accept this because (1) precise error UX helps the common case of typo'd emails, and (2) for the boilerplate's low-stakes default audience, enumeration isn't a primary threat. **If your project handles sensitive accounts (financial, medical, social-graph, anything where "X has an account here" is itself confidential), normalize `requestSignInOtp` to always return `ok(undefined)` and show a generic "If an account exists, we sent a code" message.** Per-IP rate limiting (already in place) blunts mass enumeration but does not eliminate it.

## Accessibility

- All components must pass `eslint-plugin-jsx-a11y` rules
- Smoke e2e tests verify A11y via `@axe-core/playwright`
- Use semantic HTML (`<main>`, `<nav>`, `<article>`)
- All form fields have associated labels
- All images have meaningful `alt` (or `alt=""` if decorative)

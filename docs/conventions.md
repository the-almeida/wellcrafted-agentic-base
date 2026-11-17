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

- Co-located: `foo.ts` + `foo.test.ts` (unit), `foo.integration.test.ts` (integration), or `Foo.tsx` + `Foo.test.tsx` (component, runs in jsdom with Testing Library)
- E2E tests in `/e2e/`
- Test name describes behavior, not implementation
- Reads like a spec: "user can sign in with valid credentials"

## Test quality

A test is a falsifiable claim about behavior. If no realistic bug could flip it from green to red, it is decoration, not protection. This section is the project's canon on what makes a test load-bearing; `@wc-test-auditor` enforces it after each GREEN cycle of `/wc-tdd`.

### Principles

`@wc-test-auditor` reads this section as its canon (`.claude/agents/wc-test-auditor.md` points here). The pattern table below is illustrative, not a substitute for judgment.

1. **Falsifiable.** Before writing a test, name a one-line change to the code being tested that this test would catch. If you can't, do not write the test.
2. **Caller's language.** Tests describe behavior at the public interface (HTTP, Server Action, exported function, rendered UI). Internal names, private functions, or private state in a test name or assertion is a signal the test is brittle and will break on refactor.
3. **One diagnostic reason to fail.** A failing test should point at one behavior. If a test can fail for three unrelated reasons, split it.
4. **Every line earns its place.** Setup, action, and assertion lines must each be load-bearing for the behavior being tested. A fixture value that the code under test never reads, a `fill` that satisfies validation the action does not trigger, a header that no handler inspects — these are evasive lines (see `CONTEXT.md`).
5. **Specific to regressions, robust to refactor.** Assertions narrow enough that a real regression breaks them, wide enough that legitimate refactors don't. `.toBeTruthy()` rarely passes the first half; full-DOM snapshots rarely pass the second.
6. **Passes for the right reason.** Green is necessary, not sufficient. Verify the code path implied by the test was actually exercised. The RED failure message is the primary cross-check: GREEN must resolve the same reason RED failed.
7. **I/O sources are controlled.** Time, randomness, and external state are the three flake sources. `waitForTimeout` used as a substitute for waiting on a deterministic ready signal is a band-aid that ages into a flake. The only legitimate `waitForTimeout` is a deliberate negative probe ("after 1s, this side effect should NOT have happened"), and even then prefer asserting on the absence of the artifact directly.
8. **Cost-of-change lives in production code, not tests.** If a test forced you to add a flag, field, or branch the production code didn't otherwise need, the test design is suspect. Tests describe consumer-facing behavior; if no consumer needs the new flag, the test invented a fake consumer.

### Evasive-test patterns

These are the concrete patterns `@wc-test-auditor` flags. Each violates one or more principles above. The heuristic ID is the value used in `// @wc-test-auditor-allow: <id> — <reason>` overrides.

| ID                      | Pattern                                                                                                                                                                                                                      | Principle |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `setup-not-justified`   | Setup line whose value never appears in the action or the assertion. The line was added to get past something that turned out not to block the test.                                                                         | 4         |
| `red-green-mismatch`    | GREEN passes but the code path the test claims to exercise is not actually touched by the GREEN diff. Test is green for an unrelated reason.                                                                                 | 6         |
| `noop-negative`         | `toHaveCount(0)` / `.not.toBeVisible()` on a selector that has never rendered in any prior state of this test. The negative assertion was never going to fail anyway.                                                        | 1         |
| `wide-mouth`            | `.toBeTruthy()`, `.toBeFalsy()`, `.toBeDefined()`, `expect(spy).toHaveBeenCalled()` with no arg-shape check, `.resolves` without a value check. Asserts something is "anything."                                             | 5         |
| `swallowed-failure`     | `try/catch` in test body, `.catch(() => {})`, `expect(...).rejects` without an error-shape assertion. The failure path is hidden from the test runner.                                                                       | 3         |
| `internal-mock`         | Mocking the code being tested or its internal (non-port) collaborator. (Already a hard rule in `/wc-tdd`; the agent re-verifies by reading code.)                                                                            | 2         |
| `sleep-band-aid`        | `waitForTimeout` used to wait for state that has a deterministic ready signal.                                                                                                                                               | 7         |
| `assertion-on-bug`      | Assertion text comes from a known error/regression path rather than a positive spec. Fixing the regression makes the assertion silently true.                                                                                | 1         |
| `other-cause-rejection` | A rejection test (`success: false`, 4xx, error result) passes because the input also breaks another rule, so it stays green if the rule it names is removed. Make every other field valid and assert the error path or code. | 1, 6      |
| `concurrency-by-luck`   | A concurrency test fires parallel calls and checks only the final state, which running them one after another also produces. Force the interleaving (hold a lock, wait on a signal) and assert what only the guard prevents. | 1, 7      |
| `skip-or-only`          | `.skip` / `.only` / `xit` / `fit` left in the test file.                                                                                                                                                                     | —         |

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

  The override is per-finding (per heuristic ID), not per-test — other heuristics still run on the same lines. The reason must be specific and verifiable, e.g. `// @wc-test-auditor-allow: setup-not-justified — header read by the proxy's request-id tracing, not by the handler`. A vague reason ("not applicable", "fine", "needed for the test") is itself a finding.

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
- Handler order: `requireUser` → input validation → load entity from DB → call module policy → perform work. When the policy needs the entity, the handler stays thin (`requireUser` → validation) and hands the user to a `*.logic.ts` function that loads, authorizes and writes; that function is what the integration tests call (see `src/modules/example-entity/`)
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

- Per-IP and per-email limits where applicable; per-IP alone lets one bot saturate a single email's bucket, per-email alone lets an attacker scrape by varying emails. Wire both, per IP first: a call the IP limit refuses must not count against the email, or one IP over its limit can lock any email out. The auth actions share `limitPublicAuthCall` (`src/modules/auth/features/public-auth-rate-limits.ts`)
- Build email keys with `rateLimitKey(endpoint, 'email', email)`. It trims and lowercases the address; without that, every capitalization of one address gets its own bucket while all of them reach the same Supabase account
- Do not count on Supabase Auth's own rate limits for app traffic. The auth calls leave from the Next.js server, so Supabase may see the server's IP instead of the user's, and its "per IP" limits would then apply to the whole app at once (not verified; check before relying on it). Every public endpoint, the scaffold's auth flows included, calls `rateLimit` itself
- `rateLimit` is defense against abuse, not authorization. When Redis is unavailable it fails open: the call proceeds, and the failure goes to `logger.error` and Sentry (the key is left out, since it can contain an email). The Redis client uses a 1s timeout and a single retry, so an outage costs at most about two seconds per call

### Backends

- **Redis** when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are both set. The `env` module rejects one without the other, because silently falling back to memory would multiply every limit by the number of instances. The client is `@upstash/redis` (Vercel deprecated `@vercel/kv`), so any Upstash-compatible REST endpoint works
- **In memory** when neither is set. Counters reset on restart and are not shared across instances: fine for local dev and single-instance deploys, not safe for multi-instance production. A warning is logged on first use
- Counting is a fixed window, done in one Lua script so a counter can never be left without an expiry. A counter found without one (left by older code) gets an expiry on its next call

### Deploying to Vercel

1. Storage → Marketplace → pick a Redis offering (for example Upstash) and connect it to the project. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`; the Upstash integration page uses these names ([vercel.com/marketplace/upstash/upstash-kv](https://vercel.com/marketplace/upstash/upstash-kv), checked 2026-11-12), but confirm them in the project's env settings after installing
2. Redeploy. The warning about in-memory rate limiting disappears from the logs

### Tests

- This is the reference port ([ADR-0007](./adr/0007-ports-need-a-second-checked-implementation.md)): an interface (`limiter.ts`), two real implementations, and one contract suite they both pass. Copy its shape when a dependency earns a port
- The same contract suite runs against both backends (`src/shared/lib/rate-limit/contract.test-helper.ts`). The Redis run uses a real Redis behind `serverless-redis-http`, which speaks the Upstash REST API, from `docker-compose.yml`
- `pnpm dev`, `pnpm bootstrap` and CI run `docker compose up -d`. Without it the Redis tests fail with a message saying so; they are never skipped
- The DoD verifies rate limiting on new public endpoints

## OAuth providers

A provider (Google, Facebook) is **active** when its client id is set in the app's environment (`GOOGLE_OAUTH_CLIENT_ID`, `FACEBOOK_OAUTH_CLIENT_ID`). Only active providers get a button on the sign-in and sign-up pages; with none active, the buttons and the "or" divider disappear. Client ids are public (they show up in the provider's redirect URL), so putting them in the app's environment exposes nothing.

Supabase Auth must have exactly the same providers enabled. The app cannot set that for you: locally it lives in `supabase/config.toml` (`enabled` does not accept `env()`; the CLI rejects it in boolean fields), and in production in the Supabase dashboard (Authentication → Providers).

`pnpm build` runs `pnpm check:oauth-providers` first. It reads Supabase Auth's public `GET /auth/v1/settings` with the anon key and fails the build, everywhere (locally, in CI and on deploys), when:

- a supported provider is enabled in Supabase but not active in the app, or the other way round;
- any other OAuth provider is enabled in Supabase. The app has no button for it, but anyone can still use it by calling Supabase directly with the public anon key;
- Facebook is active but `FACEBOOK_OAUTH_CLIENT_SECRET` is not set (see below);
- Supabase cannot be asked (not running, wrong URL or anon key, or an answer that is not the settings).

It also fails when the app's **anonymous mode** and Supabase's anonymous sign-ins (`external.anonymous_users`) disagree. Anonymous mode is on unless `ANONYMOUS_SIGN_INS_ENABLED=false`; any other value than `true`/`false` fails too. Off in the app but on in Supabase is refused as well: anyone with the anon key could still sign in anonymously. A new fork therefore fails its first build until anonymous sign-ins are enabled in the Supabase dashboard or the variable is set to `false`; the message names both ways out.

Email and phone sign-ins are not part of this check.

An OAuth sign-in records the account's email as verified (`public.users.email_verified_at`, see **verified email** in CONTEXT.md). That relies on the enabled providers returning only verified emails, which Google and Facebook do; check it before enabling another provider.

The check runs at build time only. A provider enabled in the Supabase dashboard after a deploy goes unnoticed until the next build, so change providers through a deploy, not just in the dashboard.

### Facebook data deletion callback

Facebook requires a data deletion callback: when someone removes the app from their Facebook account, Facebook POSTs a `signed_request` to `/api/auth/facebook/data-deletion`, signed with the App Secret. Unlike Google's secret, which only Supabase uses, the Facebook secret is also needed by the app itself, to verify that signature. The route answers:

- **404** when neither `FACEBOOK_OAUTH_CLIENT_ID` nor `FACEBOOK_OAUTH_CLIENT_SECRET` is set: the project never used Facebook.
- **503** `facebook_data_deletion_not_configured` when Facebook is active but the secret is missing. This is a deploy mistake that loses real deletion requests, so it is also logged with `logger.error` and sent to Sentry (after the per-IP rate limit, so callers cannot flood either). The build check refuses this setup, and the server logs a warning at startup if it happens anyway (for example, the env changed after the build).
- Otherwise it verifies the signature and records the deletion request (per-IP rate limit, 8KB body cap).

The secret alone keeps the callback working. To turn Facebook sign-in off, remove the client id but **keep the secret** while anyone who signed in with Facebook still has an account: Facebook keeps calling the callback for them, and dropping those calls would lose their deletion requests.

To enable a provider:

1. Register the app with the provider. The redirect URI is `<SUPABASE_URL>/auth/v1/callback`.
2. Locally: set its client id and secret in `.env.local`, set `enabled = true` in `supabase/config.toml`, and restart Supabase (`pnpm exec supabase stop && pnpm exec supabase start`); the CLI reads `.env.local` only on start.
3. In production: enable the provider in the Supabase dashboard with the same client id and secret, and set the client id in the deploy environment. For Facebook, also set `FACEBOOK_OAUTH_CLIENT_SECRET` there (see above).

## Auth: accepted trade-offs

These are deliberate choices the boilerplate makes that a downstream project may want to revisit:

- **No auth message reveals whether an email has an account, except password sign-up.** The Supabase adapter answers with fixed messages (`AUTH_ERROR_MESSAGES` in `src/modules/auth/ports/auth-provider.ts`), never Supabase's own text. A wrong password and an unknown email get the same message, and so do a wrong code and a code for an unknown email. A sign-in code request answers the same whether or not the account exists (only real accounts get a code), and the page says "If an account exists for …, we sent a 6-digit code". Supabase's "code sent moments ago" limit only fires for real accounts, so it is answered as sent too, and logged: it also fires when the project's hourly email cap is used up, and then real users get no email.
- **Password sign-up still reveals existing accounts.** With Confirm email off (`enable_confirmations = false`), a new email is signed in right away and a registered one is refused (with a fixed message), so the outcome tells the two apart. Per-IP and per-email rate limits slow probing; they do not stop it. To close it, turn Confirm email on: sign-up then always answers "check your email", and only the owner of the address gets in. That changes the sign-up flow, its e2e tests and the deployment guide.
- **Pre-account takeover, also because Confirm email is off.** Someone can sign up (or keep an anonymous account) with another person's email and a password they choose; Supabase marks the email confirmed. Mitigated by the **first email proof** (`src/modules/auth/features/email-proof.ts`): the first time anyone proves the account's email (a code, or OAuth), the password is replaced by a random one and every other session ends, so whoever proved the email keeps the account; an account that existed before that sign-in is sent to `/account/set-password`. Supabase stores a random password hash even for accounts created without a password, so this runs on every first proof (harmless when nobody set one). It is one database transaction (`public.secure_first_email_proof`) that then locks the account for 15 seconds: Supabase Auth checks a session once and writes later, so a password change or sign-in the other person sent just before would otherwise land just after and undo it. During those seconds the account cannot be changed or signed into at all (`/account/set-password` asks to wait). The ended sessions' access tokens stay valid for reading data until they expire (up to an hour); Supabase refuses them for any auth call. Until the real owner proves the email, the other person keeps the account. Turning Confirm email on closes this completely.
- **Anonymous accounts** (ADR-0008). "Continue without an account" signs in anonymously from the browser; the account can see and be seen, and edit its nickname, nothing else (`requireUser()` refuses it by default; policies refuse its writes). Keeping it adds an email and password at once, without checking the email: a made-up address works, but then the password cannot be recovered (the form says so). The CONFLICT answer for an email that already has an account tells the two apart, like password sign-up; it is rate limited per account (5 per hour). An anonymous person who loses the session (cookies cleared, another device) before keeping the account cannot get back in: the account stays until someone deletes it in the database. Supabase limits anonymous sign-ins to 30 per hour per IP; there is no captcha until abuse appears.
- **A stolen session can take the account.** With Confirm email off, `updateUser({ email })` changes the email at once, so whoever holds a valid session can move the account to their own email and reset the password there. Turning Confirm email on (with secure email change) makes an email change need a code.
- **Timing.** Password sign-in likely answers faster for an unknown email (no password hash to check) than for a real account; not measured here. A sign-in code request takes longer for a real account (Supabase sends an email) than for an unknown one (about 85 ms against 14 ms locally; more with real SMTP). Closing that would mean sending after the response, losing error reporting; with the password sign-up leak above still open, it would buy nothing.

## Accessibility

- All components must pass `eslint-plugin-jsx-a11y` rules
- Smoke e2e tests verify A11y via `@axe-core/playwright`
- Use semantic HTML (`<main>`, `<nav>`, `<article>`)
- All form fields have associated labels
- All images have meaningful `alt` (or `alt=""` if decorative)

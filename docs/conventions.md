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

- Per-IP and per-account limits where applicable
- Supabase Auth provides built-in rate limiting on its endpoints; the scaffold's auth flows benefit from that automatically. New public endpoints do NOT inherit this protection
- The `src/shared/lib/rate-limit/` folder is a skeleton. Implementation depends on infrastructure (Upstash Redis, Vercel KV, in-memory for single-instance). Decide once, document, apply consistently
- The DoD verifies rate limiting on new public endpoints

## Accessibility

- All components must pass `eslint-plugin-jsx-a11y` rules
- Smoke e2e tests verify A11y via `@axe-core/playwright`
- Use semantic HTML (`<main>`, `<nav>`, `<article>`)
- All form fields have associated labels
- All images have meaningful `alt` (or `alt=""` if decorative)

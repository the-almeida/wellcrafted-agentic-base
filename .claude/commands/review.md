---
description: Self-review against the Definition of Done before opening a PR.
---

# Self-Review

Read `git diff main...HEAD` (or the staged diff if no PR exists yet). Walk through the Definition of Done in `docs/dod.md`. For each item, state one of:

- **PASS** — verified
- **FAIL** — with a one-line explanation
- **N/A** — with a one-line justification

When done, summarize:

- Number of PASS / FAIL / N/A
- Specific things to fix before merging

Do not skip items. Do not gloss over FAIL items. The review is worthless if it is permissive.

## Areas requiring extra care

- **Security**: any change touching authentication, authorization, payments, or PII handling. Recommend invoking `@security-auditor` if any of these were touched
- **Boundaries**: cross-module imports must go through `index.ts` only
- **Policies**: any module with new handlers must have `domain/policy.ts`
- **Tests**: each new behavior has a test; RED was observed before GREEN
- **Error handling**: server actions wrapped with `withErrorBoundary`; route handlers NOT wrapped (auto-captured); expected errors via `Result`
- **Branded types**: new IDs constructed via Zod schemas, never via free casts
- **Auth**: `getUser()` not `getSession()` for authorization
- **Observability**: new events declared in `events.ts` and `schemas.ts`; logs include `requestId`
- **Accessibility**: no `eslint-plugin-jsx-a11y` violations; new pages covered by axe-core smoke

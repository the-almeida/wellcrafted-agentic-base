# 0004. Result Types for Expected Errors

Date: 2026-05-13
Status: Accepted

## Context

JavaScript's exception model conflates "expected errors" (validation failure, not found, forbidden) with "true bugs" (programmer errors, invariant violations). Treating both with `throw` makes it hard to reason about which errors a function can produce, and makes happy paths look like exception paths.

## Decision

- Use `Result<T, E>` (a discriminated union of `{ ok: true, value }` and `{ ok: false, error }`) for **expected errors**.
- Use `throw` only for **true bugs** — programmer errors, invariant violations, things that should not happen if the code is correct.
- Server actions are wrapped with `withErrorBoundary`, which catches unexpected throws, logs them, sends them to Sentry, and re-throws so Next.js handles the response. This wrapper exists specifically because Sentry's Next.js SDK does NOT auto-instrument server actions.
- Route handlers and Server Components are NOT wrapped. They are auto-captured by Sentry's `onRequestError` hook (registered in `instrumentation.ts`).

## Alternatives considered

- **Throw for everything, catch in middleware**. Rejected: function signatures lie about what they can fail with. Easy to forget a try/catch and break the user experience.
- **`neverthrow` library**. Considered. Rejected for now: the surface area we need is small, a hand-rolled `Result` type is five lines and zero dependencies.
- **Tuple `[error, value]` like Go**. Rejected: less type-friendly than discriminated unions. Easy to forget which slot holds what.
- **Wrap everything (including route handlers) for consistency**. Rejected: duplicates Sentry's auto-capture and adds a permanent abstraction layer for no runtime benefit. The asymmetry mirrors Next.js's actual behavior.

## Consequences

Positive:

- Function signatures honestly state what they can fail with
- Compiler forces error handling at the call site
- Happy paths are visually distinct from error paths

Negative:

- More verbose than `throw`/`catch` for chains of operations
- Requires discipline to NOT pepper the code with `if (result.ok === false) throw new Error(...)` (which defeats the point)
- The "wrap server actions, don't wrap route handlers" asymmetry must be documented and remembered

# 0005. RLS as Defense-in-Depth, Not Primary Authorization

Date: 2026-05-13
Status: Accepted

## Context

Supabase encourages Row Level Security (RLS) as the primary authorization mechanism, especially when the browser talks directly to PostgREST. We use Next.js with server actions and route handlers, so the browser never talks to Postgres directly. Putting business logic in RLS policies has known downsides: hard to unit test, poor error messages, performance opacity, lock-in.

## Decision

- Authorization runs in the application layer via per-module `Policy` instances. The auth module provides the `Policy<T>` type and helpers (`requireUser`, `isAdmin`); each module declares its own action union and policy in `domain/policy.ts`.
- Policies are pure functions over discriminated unions — type-safe, exhaustive, testable in isolation.
- RLS is enabled on every user-owned table with **minimal** policies: ownership-only (`auth.uid() = user_id`). No business logic.
- The backend uses the Supabase service role key, which bypasses RLS. RLS only fires for connections under the `authenticated` role, which we do not use.
- RLS exists as a backstop: if a developer forgets to call the module's policy and somehow connects with the `authenticated` role, RLS prevents the worst case.

## Alternatives considered

- **RLS as primary authorization, no policies in app**. Rejected: business logic in SQL is hard to test, error messages are opaque, performance is hard to reason about, locks us into Supabase.
- **No RLS at all, application-only**. Rejected: removes the defense-in-depth layer for the cost of a few minimal policies.
- **Application-only with auditing in DB triggers**. Considered. Rejected for the scaffold: triggers add complexity, and the audit need is not yet present.
- **Centralized `can(user, action)` discriminated union in auth module**. Rejected: see ADR 0001.

## Consequences

Positive:

- Authorization is testable, type-safe, and per-module
- Error messages are precise (`ForbiddenError("cannot update post X")`)
- Migration away from Supabase costs little
- Auth module stays extractable (no knowledge of other modules' actions)

Negative:

- Two places define ownership: each module's `Policy` and the RLS policy. They must stay aligned (we keep RLS minimal so this is mostly trivial)
- Developers must remember to call the module's policy (the DoD checklist, `/review`, and the policy-presence CI check enforce this)

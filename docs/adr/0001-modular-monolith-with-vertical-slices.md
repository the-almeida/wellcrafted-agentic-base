# 0001. Modular Monolith with Vertical Slices, Hexagonal Boundaries, and Per-Module Policies

Date: 2026-05-13
Status: Accepted

## Context

We are building a boilerplate that will be forked into many future projects. The architecture must:

- Stay simple for CRUD-heavy modules
- Scale to complex modules with real domain invariants
- Make it cheap to swap external providers (LLM, payment, email)
- Make it possible to extract a module into a separate service later without a rewrite
- Stay enforceable by tooling, not by good intentions

## Decision

Combine three patterns plus a per-module authorization model:

1. **Modular Monolith** at the macro level — `src/modules/<domain>/` with hard boundaries, cross-module communication only via the public `index.ts`
2. **Vertical Slice** at the medium level — `features/<feature>/` co-locating handler, schema, logic, and tests
3. **Hexagonal (Ports & Adapters)** at the micro level — interfaces in `ports/`, implementations in `adapters/`, only when external dependencies exist
4. **Per-module authorization** — the auth module exposes only `requireUser`, `isAdmin`, and the `Policy<T>` type. Each module declares its own action union and policy in `domain/policy.ts`

Boundaries are enforced by `eslint-plugin-boundaries` in CI. Per-module policies are enforced by a CI script that fails when a module has features but no `policy.ts`.

## Alternatives considered

- **Layered architecture** (controllers / services / repositories spread across the codebase). Rejected: changes for one feature touch many folders. Hard to reason about ownership.
- **Pure DDD with CQRS, aggregates, domain events everywhere**. Rejected: too much ceremony for CRUD. We allow tactical DDD only inside modules with real invariants.
- **Microservices from day one**. Rejected: premature distribution costs. The modular monolith preserves the option to extract later.
- **Centralized `can(user, action)` with all actions in auth's discriminated union**. Rejected: auth would need to import every consuming module's types, breaking the modular monolith's "any module is extractable" promise. The centralized audit benefit is mythical (you can grep `Policy<` across modules and get the same view).

## Consequences

Positive:

- Clear ownership for every change
- Boundaries enforced by tooling, not discipline
- Easy provider swaps via ports/adapters
- Module extraction is work, not rewrite
- Auth module is genuinely extractable (no knowledge of other modules)

Negative:

- More structure than a flat Next.js app for very small projects
- Authors must learn the pattern before contributing
- The `index.ts` public API requires deliberate curation
- No single file lists every action in the system (mitigated by CI policy check + grep)

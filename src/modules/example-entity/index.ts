/**
 * Example Entity Module
 *
 * This module demonstrates the project's architecture pattern. It is meant to
 * be deleted once you ship your first real module, but reference it as a
 * template until then.
 *
 * ============================================================================
 * ARCHITECTURE
 * ============================================================================
 *
 * Three patterns combine here, each solving a different scale, plus a
 * per-module authorization model:
 *
 * 1. MODULAR MONOLITH (macro / between domains)
 *    Each module under `src/modules/` is an independent unit with a hard
 *    boundary. Cross-module communication happens only through the public
 *    `index.ts` (this file). Direct imports from other modules' internals
 *    are blocked by `eslint-plugin-boundaries`.
 *
 *    Why: keeps domains decoupled. If the project grows, any module can be
 *    extracted into a separate service without rewriting it.
 *
 * 2. VERTICAL SLICE (medium / inside a module)
 *    Each user-facing capability lives in `features/<feature-name>/` with
 *    everything it needs co-located:
 *      - <feature>.handler.ts   server action or route-handler logic
 *      - <feature>.schema.ts    Zod input/output schemas
 *      - <feature>.logic.ts     pure domain logic (only when complex)
 *      - <feature>.test.ts      tests next to the code they cover
 *
 *    Why: changes for a feature touch one folder. Removing a feature is a
 *    folder delete. No "service layer", "controller layer", "repository layer"
 *    spread across the codebase.
 *
 * 3. HEXAGONAL / PORTS & ADAPTERS (micro / external integrations)
 *    The module declares what it needs from the outside as interfaces in
 *    `ports/` (e.g. a repository, an LLM client, an email sender). Concrete
 *    implementations live in `adapters/` (e.g. Drizzle repo, Claude client,
 *    Resend sender). The domain layer never imports SDKs directly.
 *
 *    Why: swap providers without touching domain logic. Tests use mock
 *    adapters for determinism. Local dev can use cheap/fake adapters.
 *
 * 4. PER-MODULE AUTHORIZATION (the policy lives here, not in auth)
 *    The auth module exposes only the `Policy<T>` type, `requireUser`, and
 *    `isAdmin`. Each module that needs auth checks declares its own action
 *    union and policy in `domain/policy.ts` and exports them. The auth
 *    module knows nothing about this module's actions.
 *
 *    Why: keeps the modular monolith honest. A new module never forces an
 *    edit to auth. Auth stays extractable as its own service.
 *
 * ============================================================================
 * WHAT IS REQUIRED VS OPTIONAL
 * ============================================================================
 *
 * REQUIRED for every module:
 *   - features/                  vertical slices with handler + schema + tests
 *   - index.ts                   the only public API surface
 *
 * REQUIRED when handlers perform authorization:
 *   - domain/policy.ts           action union + Policy<TAction> instance
 *
 * OPTIONAL, add only when the module needs them:
 *   - domain/<other>             only when there are real invariants to
 *                                protect (rules that must hold true regardless
 *                                of how the data is changed). Pure CRUD does
 *                                not need this.
 *   - ports/ + adapters/         only when the module talks to something
 *                                external that could change (DB, LLM, payment,
 *                                email, third-party API). Internal helpers do
 *                                not need a port.
 *
 * If a feature is a thin wrapper around a database write, it can live entirely
 * inside features/<feature>/ without touching domain/ or ports/. Do not create
 * empty layers "for consistency". Every layer must earn its place.
 *
 * ============================================================================
 * HOW TO ADD A NEW MODULE
 * ============================================================================
 *
 * 1. Create `src/modules/<your-module>/` with `features/` and `index.ts`.
 * 2. Build the first feature as a vertical slice.
 * 3. Add `domain/policy.ts` as soon as a handler needs auth checks. Define
 *    your `Action` union and export an instance of `Policy<YourAction>`.
 * 4. Add other `domain/` files only when invariants emerge.
 * 5. Add `ports/` + `adapters/` only when an external dependency appears.
 * 6. Export from `index.ts` only what other modules legitimately need.
 *    Keep the surface small. The smaller the public API, the easier the
 *    module is to evolve.
 *
 * Cross-module imports: only via the other module's `index.ts`.
 * Never import `@/modules/foo/features/...` from outside the foo module.
 *
 * See `docs/adr/0001-modular-monolith-with-vertical-slices.md` for the
 * decision record behind this structure.
 */

export type { ExampleEntity } from './domain/example-entity'
export type { ExampleAction } from './domain/policy'
export { examplePolicy } from './domain/policy'

export { createExampleEntity } from './features/create-example-entity/create-example-entity.handler'
export { deleteExampleEntity } from './features/delete-example-entity/delete-example-entity.handler'
export { updateExampleEntity } from './features/update-example-entity/update-example-entity.handler'

# Architecture

## Three patterns combined

`wellcrafted-agentic-base` combines three patterns, each solving a different scale:

1. **Modular Monolith** — boundaries between domains
2. **Vertical Slice** — organization within a module
3. **Hexagonal (Ports & Adapters)** — isolation at external integration points

## 1. Modular Monolith (macro level)

Each domain lives under `src/modules/<domain>/` with strong boundaries. Cross-module communication only through the public `index.ts`. Direct imports between module internals are blocked by `eslint-plugin-boundaries`.

**Why**: domains stay decoupled. Any module can be extracted into its own service later without rewriting it.

## 2. Vertical Slice (medium level)

Each user-facing capability lives in `features/<feature>/` with everything co-located:

- `<feature>.handler.ts` — server action or route handler logic
- `<feature>.schema.ts` — Zod input/output schemas
- `<feature>.logic.ts` — pure domain logic (only when complex enough)
- `<feature>.test.ts` — tests next to the code they cover

**Why**: changes for a feature touch one folder. Removing a feature is a folder delete. No "service layer" / "controller layer" / "repository layer" sprawl.

## 3. Hexagonal Ports & Adapters (micro level)

Modules declare external dependencies as interfaces in `ports/`. Concrete implementations live in `adapters/`. Domain code never imports SDKs directly.

**Why**: swap providers without touching domain logic. Tests use mock adapters for determinism. Local dev can use cheap or fake adapters.

## Authorization model

Authorization is **per-module**, not centralized. The auth module exposes only the contract (`requireUser`, `isAdmin`, `Policy<T>`) and knows nothing about other modules' actions. Each module declares its own action union and policy in `domain/policy.ts` and exports them via its `index.ts`.

This is what keeps the modular-monolith claim honest: a new module never forces an edit to auth. Auth is extractable into its own service without coupling. The cost is no single file enumerating every action; the mitigation is a CI check that ensures every module with handlers has a `domain/policy.ts`.

## Required vs Optional structure

REQUIRED in every module:

- `features/`
- `index.ts`

REQUIRED when handlers perform authorization:

- `domain/policy.ts` exporting an instance of `Policy<TYourAction>`

OPTIONAL, add only when needed:

- `domain/` (other than `policy.ts`) — only when there are real invariants
- `ports/` + `adapters/` — only when external dependencies exist

Do not create empty layers "for consistency". Every layer must earn its place.

## Boundaries

Enforced by `eslint-plugin-boundaries`:

- `app` may import from `module` (only via `index.ts`), `shared-*`
- `proxy` may import from `module` (only via `index.ts`), `shared-lib`, `shared-obs`
- `module-internal` may import from `shared-*` and same-module internals
- `module-internal` MAY NOT import from another module's internals
- `shared-*` MAY NOT import from `modules`

## Cross-module communication

Only through `<module>/index.ts`. No event bus in the scaffold. If two modules need to coordinate beyond synchronous calls, that's a signal to revisit the boundary.

## Database migrations: Drizzle authors structure, Supabase CLI runs the sequence

Drizzle owns table structure. Supabase CLI owns RLS, triggers, functions, and extensions. Both kinds of migration land in `supabase/migrations/` and run as a single timestamp-ordered sequence under Supabase CLI's runner. See ADR-0003 for the reasoning behind this consolidation.

Workflow for adding a new table that also needs RLS:

1. Edit the Drizzle schema in `src/shared/db/schema/`
2. `pnpm db:generate --name <descriptive_slug>` — Drizzle emits SQL into `supabase/migrations/` with the Supabase timestamp prefix. Always pass `--name` so the migration file reads `<timestamp>_add_audit_log.sql` rather than `<timestamp>_smiling_silhouette.sql` (Drizzle's random-slug default)
3. `supabase migration new <name>` — hand-author the RLS / trigger SQL (its later timestamp means it runs after the Drizzle file)
4. `supabase db reset` — drops the local DB and re-applies the whole sequence in order, proving Drizzle output and hand-authored SQL compose cleanly
5. Commit both migration files in the same commit

The DoD enforces "both migrations present in the same commit" for any change adding a table.

## Runtime model

The proxy (`src/proxy.ts`, Next 16's renamed middleware) AND every route run on the **Node** runtime. Edge runtime is forbidden across the scaffold. Rationale:

- Pino requires Node APIs
- AsyncLocalStorage continuity is Node-only
- `node:crypto`, `Buffer`, and native modules don't exist on Edge
- The performance gain from Edge is unmeasurable for the scaffold's use cases (auth-gated app, server actions, Supabase round trips that dominate latency)

The ban is enforced by `scripts/check-no-edge.sh` (runs in pre-push and CI): grep for `runtime = 'edge'` across `src/` and fail if found. To override, delete that check, document the override in an ADR, and confirm the affected route does not import Pino or rely on ALS context.

## Adding a new module

1. Create `src/modules/<your-module>/` with `features/` and `index.ts`
2. Build the first feature as a vertical slice
3. Add `domain/policy.ts` as soon as a handler needs auth checks. Define your `Action` union and export a `Policy<YourAction>` instance
4. Add other `domain/` files only when invariants emerge
5. Add `ports/` + `adapters/` only when an external dependency appears
6. Export from `index.ts` only what other modules legitimately need

The smaller the public API, the easier the module is to evolve.

# 0003. Drizzle Owns Schema; Supabase CLI Runs Migrations

Date: 2026-05-13
Status: Accepted

## Context

We want Drizzle's typed schema + SQL generation for table structure, and Supabase's first-class support for RLS, triggers, and functions. Drizzle does not express RLS natively; Supabase CLI does not generate types from a TypeScript schema. The two are complementary at the _authoring_ layer.

They are NOT complementary at the _runner_ layer. A migration sequence is an ordered DDL log against a single Postgres instance: later statements (RLS policies, FKs, triggers) reference structure created by earlier ones (CREATE TABLE). If two separate runners apply two separate lists of migrations, you have one logical sequence with two state-tracking tables — `__drizzle_migrations` and `supabase_migrations.schema_migrations` — that can disagree about what has been applied. Partial state, schema drift, and "works on my machine" follow.

The first version of this scaffold kept the runners separate: Drizzle output to `src/shared/db/migrations/`, Supabase migrations to `supabase/migrations/`. The very first hand-authored Supabase migration (FK from `public.users` to `auth.users`, plus the new-user trigger) referenced a Drizzle-owned table. `supabase start` ran the FK migration against a fresh DB before Drizzle's `CREATE TABLE` had a chance to execute, and it failed every time on a clean machine.

## Decision

Keep the ownership split exactly as designed:

- **Drizzle** is the source of truth for table structure (`src/shared/db/schema/`). All `CREATE TABLE` and `ALTER TABLE` originate from TypeScript schema definitions and are emitted by `drizzle-kit generate`.
- **Supabase CLI** owns RLS policies, triggers, functions, extensions, and other database-level concerns that Drizzle does not natively express. These are hand-authored.

Change one thing: **`drizzle-kit generate` writes its output into `supabase/migrations/` using `prefix: 'supabase'` so filenames match Supabase CLI's expected `<14-digit-timestamp>_<name>.sql` format.** Supabase CLI then applies the entire folder — Drizzle-generated and hand-authored alike — in timestamp order, as one sequence, tracked in one state table.

Concretely:

- `drizzle-kit migrate` is no longer invoked. `pnpm db:migrate` aliases `supabase migration up --local`.
- `supabase start`, `supabase db reset`, and `supabase migration up` are the only commands that touch the migration state.
- The Drizzle output directory `src/shared/db/migrations/` is removed.

This is not a softening of the ownership split. Drizzle still owns _what to put in the schema_. Supabase CLI still owns _RLS, triggers, functions_. The change is purely about which tool runs the resulting SQL files, and the answer is the tool that's already running the local Postgres stack and applying its own SQL on every `start` / `reset`.

## Alternatives considered

- **Two runners, fix the ordering in `bootstrap.sh`** (run `supabase start`, then `pnpm db:migrate`, then `supabase db reset` to re-apply Supabase migrations on top). Rejected: `db reset` drops the database, so the workaround loops. The fundamental issue — two state tables, one logical sequence — survives.
- **Move `public.users` (and any other "Supabase-prereq" table) out of Drizzle and into a hand-authored Supabase migration**. Rejected: leaks RLS-ordering concerns into the schema authoring layer. Every new table that needs RLS becomes a question of "which migration system owns it?", and the answer drifts over time. Drizzle should stay the unambiguous owner of table structure.
- **Use Drizzle's programmatic migrator (`drizzle-orm`'s `migrate()`) in an init script** ahead of `supabase start`. Rejected: the migrator needs a live Postgres to connect to, which Supabase hasn't started yet. Bootstrapping a temporary Postgres just to run Drizzle's migrator first is enormous machinery for no payoff over consolidating on Supabase CLI's runner.
- **Drop Drizzle Kit's migration generation entirely; use `drizzle-kit push` for local dev and hand-write all production migrations as Supabase migrations**. Rejected: loses schema-as-code reproducibility, makes review of structural changes harder, and forces translation between TypeScript schema and SQL by hand.
- **Prisma**. Same reasons as before: heavier abstraction, less control over generated SQL, no improvement on the runner question.

## Consequences

Positive:

- One ordered migration list, one state table, one runner. `supabase db reset` is authoritative for local DB state.
- `scripts/bootstrap.sh` shrinks to `supabase start` for the database side; no orchestration of two migration systems.
- Drizzle-generated tables and hand-authored RLS interleave naturally by timestamp; when a new table needs RLS, you write two adjacent migration files in the same folder and `supabase db reset` proves they apply in order.
- TypeScript types still flow from Drizzle into the rest of the codebase; nothing about that layer changed.

Negative:

- The Drizzle Kit migration-tracking table (`__drizzle_migrations`) is no longer maintained. That was not load-bearing for anything we use, but it does mean `drizzle-kit migrate` from this scaffold will report "no migrations to apply" — which is correct and the right answer is to delete the muscle memory of running it.
- Migration filenames in `supabase/migrations/` mix two origins (Drizzle-generated `CREATE TABLE`, hand-authored RLS/trigger). Comment in the hand-authored files; Drizzle's own files are self-explanatory from their schema-derived names.
- If a future change wants Drizzle Kit's `push` (schemas synced without migrations, for ephemeral dev DBs), that's a separate workflow and would need its own decision.

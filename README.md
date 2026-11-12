# wellcrafted-agentic-base

> Production-ready Next.js boilerplate engineered for agentic coding with high quality standards.

## What

`wellcrafted-agentic-base` is the foundation you fork to start a new project. It enforces the architecture, conventions, and tooling that let you ship fast without sacrificing quality. It is opinionated by design.

The repo is engineered around a tight feedback loop with coding agents: every rule is enforced (boundaries, types, tests, commits) so the agent stays inside the lines and the human stays in flow.

## Quick Start

Required: Node 22+, pnpm 11+, Docker, jq. The Supabase CLI is installed automatically by `pnpm install` (pinned in `devDependencies`).

```bash
git clone <repo>
cd wellcrafted-agentic-base
pnpm bootstrap
pnpm dev
```

App runs at http://localhost:3000.

`pnpm bootstrap` installs dependencies, starts the local Supabase stack (Postgres, Auth, Mailpit) in Docker, applies every migration, and writes `.env.local` with the local Supabase URL, keys, and `DATABASE_URL`. Run it once; afterwards `pnpm dev` is enough.

Useful local URLs (exact ports: `pnpm supabase:status`):

- Supabase Studio: http://localhost:54323
- Mailpit (sign-up and sign-in codes land here): http://localhost:54324

### Optional services

Only Docker (for Supabase) is required locally. Everything else can stay blank in `.env.local`:

| Service            | Env vars                                                   | When blank                                                                                |
| ------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Sentry             | `NEXT_PUBLIC_SENTRY_DSN`                                   | Not initialized, nothing is sent                                                          |
| PostHog            | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`      | `track()` / `track.client()` are no-ops                                                   |
| Redis (rate limit) | `KV_REST_API_URL`, `KV_REST_API_TOKEN`                     | In-memory counter, with a warning on first use                                            |
| Google OAuth       | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`     | "Continue with Google" button is hidden. Email sign-in still works                        |
| Facebook OAuth     | `FACEBOOK_OAUTH_CLIENT_ID`, `FACEBOOK_OAUTH_CLIENT_SECRET` | "Continue with Facebook" button is hidden; `/api/auth/facebook/data-deletion` returns 404 |

Production requirements differ (SMTP and Redis become mandatory in practice). See [docs/deployment.md](./docs/deployment.md).

### Tests

- `pnpm test:unit`: no external services needed
- `pnpm test:int`: needs local Supabase and the Redis containers (`docker compose up -d --wait`) running
- `pnpm e2e`: needs local Supabase; Playwright builds and starts the app itself

## Deployment

Vercel (app) + Supabase cloud (database and auth). Migrations are applied manually with `supabase db push`, and CI does not deploy. Full step-by-step setup, including SMTP (Resend), env vars per environment, and OAuth: [docs/deployment.md](./docs/deployment.md).

## Architecture

Modular Monolith + Vertical Slice per feature + Hexagonal (ports & adapters) at external integration points. Authorization is per-module: each module declares its own actions and policy.

```
src/
├── modules/<domain>/        # strong boundaries
│   ├── features/<feature>/  # vertical slices
│   ├── domain/policy.ts     # per-module authorization
│   ├── index.ts             # server-side public surface
│   └── client.ts            # client-side public surface (see ADR-0006)
├── shared/                  # ui, lib, db, observability
├── proxy.ts                 # Next 16 proxy (formerly middleware): session refresh + request ID
└── app/                     # Next.js routes (thin); (public)/page.tsx covers /
```

Tailwind v4 (no `tailwind.config.ts`; design tokens via `@theme` in `src/app/globals.css`). Drizzle SQL and hand-authored RLS/trigger SQL both live in `supabase/migrations/` (see ADR-0003). `playwright.config.ts` sits at the repo root.

Full details in [docs/architecture.md](./docs/architecture.md) and [ADR 0001](./docs/adr/0001-modular-monolith-with-vertical-slices.md).

## Development workflow

1. Branch from `main`: `git checkout -b feat/something`
2. Implement following the [CLAUDE.md](./CLAUDE.md) workflow (`/wc-grill` → `/wc-tdd` → `/wc-commit`)
3. Push (pre-push runs lint, typecheck, policy presence check, unit, integration)
4. Open a PR (CI runs the full suite including e2e)
5. PRs generate Vercel preview deployments automatically
6. Merge to `main` triggers production deployment automatically (apply new migrations first, see [docs/deployment.md](./docs/deployment.md#every-release))

## Conventions

See [docs/conventions.md](./docs/conventions.md).

## Gotchas

- The dev server expects Supabase CLI to be running. `pnpm dev` starts it automatically; check status with `pnpm supabase:status` if something feels off.

## Stack

- Next.js (App Router)
- TypeScript (strict)
- Drizzle (ORM, source of truth for schema)
- Supabase (Postgres + Auth via `@supabase/ssr`, RLS as defense-in-depth)
- Zod (validation)
- Vitest + Playwright
- Pino (logging) + Sentry (errors) + PostHog (analytics)
- Tailwind v4 + shadcn/ui (Radix primitives)
- ESLint + Prettier with `eslint-plugin-boundaries`

## Documentation

- [CLAUDE.md](./CLAUDE.md) — operating manual for Claude Code
- [CONTEXT.md](./CONTEXT.md) — domain glossary
- [docs/architecture.md](./docs/architecture.md) — architecture details
- [docs/conventions.md](./docs/conventions.md) — code conventions
- [docs/dod.md](./docs/dod.md) — Definition of Done
- [docs/deployment.md](./docs/deployment.md) — production setup (Vercel + Supabase)
- [docs/adr/](./docs/adr) — architecture decision records

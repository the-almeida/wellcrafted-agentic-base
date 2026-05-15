# 0006. Module Public Surface: index.ts (server) + client.ts (client)

Date: 2026-05-14
Status: Accepted

## Context

ADR-0001 established a single public surface per module: `src/modules/<domain>/index.ts`. Cross-module imports go through it; everything else is internal. `eslint-plugin-boundaries` enforces this.

That worked until the auth module needed to expose both kinds of helpers:

- **Server-only** primitives: `requireUser`, `getOptionalUser`, `updateSession`, the `Policy<T>` type, `isAdmin`. These reach into `next/headers`, Drizzle, Pino, `node:crypto`, and the Supabase server client.
- **Client-callable** helpers: the sign-in / sign-up / sign-out server actions (which are RPC stubs on the client side), and `createSupabaseBrowserClient`.

A single `index.ts` barrel meant any Client Component importing `signIn` from `@/modules/auth` pulled the entire server graph into the client bundle. Next.js's tree-shaking does not span `'use server'` / `'use client'` boundaries through a barrel when transitive imports themselves cross runtimes — the bundler errored with "you cannot import this server module into a client component" or silently bloated the client bundle, depending on which symbol was touched first.

The same shape will recur for any future module that wants to expose both server actions (callable from the client) and server-only utilities (callable only from Server Components / Server Actions / proxy). The auth module is the first instance; the example-entity module is the next likely candidate.

## Decision

Each module exposes **two** public surface files:

- `src/modules/<domain>/index.ts` — server surface. Imported by Server Components, Server Actions, Route Handlers, and `src/proxy.ts`. Free to re-export anything that touches Node-only APIs.
- `src/modules/<domain>/client.ts` — client surface. Imported by Client Components. Re-exports only what's safe to ship to the browser: server-action handlers (which become RPC stubs), browser-only adapters, and pure value/type exports.

Server actions live in their own `'use server'` handler files inside `features/<feature>/`. That `'use server'` directive is the actual RPC boundary — re-exporting the handler symbol from `client.ts` is purely a surface concern; it does not pull the handler's server-side dependency graph into the client bundle.

`eslint-plugin-boundaries` is configured to treat `(index|client).ts` as the allowed entry points for cross-module imports. The internalPath regex literally is `(index|client).ts`. Any other internal path is blocked.

A module that has no client-facing surface omits `client.ts`. A module that has no server-facing surface omits `index.ts` (unusual; rate-limit is the only candidate today and it has neither).

## Alternatives considered

- **Single `index.ts` + `'server-only'` / `'client-only'` package markers**. Add the `server-only` package as a side-effect import inside server modules so any client import errors at build time. Rejected: the failure mode is "build breaks somewhere downstream" rather than "your import is wrong." The boundaries plugin already gives precise, file-local errors; runtime tripwires duplicate that with worse ergonomics. Also doesn't solve the bundle-bloat angle when the build _does_ succeed.
- **Move server actions out of the module and into `src/app/actions/`**. Decouples the surface entirely. Rejected: it scatters a feature's vertical slice across `src/modules/<domain>/features/<feature>/` (logic, schema, test) and `src/app/actions/<feature>.ts` (the handler). The vertical-slice contract from ADR-0001 was the whole point — splitting it horizontally re-introduces the layered architecture we rejected.
- **Single `index.ts` with everything; trust the bundler to tree-shake**. Tried. Doesn't work for the cross-runtime case described above. Even when tree-shaking does succeed, it depends on import-site discipline that the linter cannot enforce.
- **One file with conditional exports** (e.g., `index.ts` re-exporting different things based on `typeof window`). Rejected: opaque, breaks static analysis, fights the bundler instead of cooperating with it.

## Consequences

Positive:

- Server-only deps stay out of client bundles by construction, not by careful import-site review.
- The split is visible: opening a module folder, you see `index.ts` and (sometimes) `client.ts`, and you immediately know there are two surfaces. No hidden runtime markers.
- `eslint-plugin-boundaries` catches the wrong import path with a precise error at lint time.
- Adding a server action that's also callable from the client is a two-line change: export from the handler file, re-export from `client.ts`.
- Modules without a client face (most non-UI modules) simply don't create `client.ts`; the rule degrades gracefully to ADR-0001's original "one public surface" model.

Negative:

- Every module author needs to decide: does this module need a `client.ts`? The answer is usually obvious (is anything imported by a `'use client'` component?), but it's one more question.
- A symbol can appear in both files when it's runtime-agnostic (pure types, plain functions). Duplication is shallow (one `export` line each) and the alternative — picking one surface arbitrarily — confuses callers.
- The ESLint boundaries config now keys off the regex `(index|client).ts`. Future surface additions (a hypothetical `worker.ts` for Web Workers, etc.) require updating the regex everywhere it appears.
- ADR-0001's text "`src/modules/<domain>/index.ts` — the ONLY public API" is superseded by this ADR. The intent (small, deliberate surface) is preserved; the count is now "at most two files."

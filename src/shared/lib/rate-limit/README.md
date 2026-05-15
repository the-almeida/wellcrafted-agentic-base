# Rate limit

Public endpoints (sign-in, sign-up, OTP request/verify, OAuth callback, webhook receivers, anything callable by anonymous users) MUST be rate-limited. The boilerplate enforces this via `rateLimit(key, config)` and the DoD verifies new handlers wire it in.

## Backends

Two backends, selected automatically by environment:

- **Vercel Marketplace Redis** (branded "Vercel KV") — used when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set. This is the production-ready path. The Vercel dashboard auto-injects both vars when you provision a Redis store from Marketplace. Storage is the Vercel-provisioned Redis; the client is `@upstash/redis` because Vercel deprecated `@vercel/kv`.
- **In-memory `Map`** — used when those vars are absent. Resets on restart, doesn't share state across replicas. Fine for local dev; **not safe** for multi-instance production. A one-time `console.warn` logs at module load when this backend is active.

The algorithm is fixed-window: `INCR` + set TTL on the first increment + compare against `max`. Sliding-window would be marginally more accurate but the extra code isn't worth it for the boilerplate's threat model.

## Usage

```ts
import { rateLimit } from '@/shared/lib/rate-limit'

const limit = await rateLimit(`otp-sign-in:email:${email}`, {
  windowMs: 60_000,
  max: 5,
})
if (!limit.ok) return limit
```

Wire **both** per-email and per-IP limits where the endpoint takes an email (sign-in, sign-up, OTP request/verify). Per-email alone lets an attacker enumerate by varying the email; per-IP alone lets a botnet split the load.

## Deploying to Vercel

1. Storage → Marketplace → choose a Redis offering (e.g. Upstash).
2. Connect it to the project; Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Redeploy. The module switches to the Redis backend on the next cold start; the warning disappears from logs.

Free Hobby tier covers low-traffic projects. Check [vercel.com/pricing](https://vercel.com/pricing) for current limits.

## Deploying elsewhere

The Redis backend reads any Redis-compatible REST URL/token, so Upstash directly (without Vercel) works the same way — set `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your Upstash REST credentials.

For non-serverless single-instance deploys (e.g. a VPS), the in-memory backend is acceptable; just be aware of the restart-resets-state caveat.

## Tests

`index.test.ts` covers the in-memory backend exhaustively: fresh keys, over-limit rejection, window reset, key isolation, no-implicit-reset on rejection. The Redis backend is trusted-without-test — the implementation is a thin `INCR` / `PEXPIRE` / compare; the parts that could fail (network, TTL semantics) belong to Redis itself, not us.

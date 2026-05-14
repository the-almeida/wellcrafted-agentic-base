# Rate limit

Skeleton. Public endpoints (sign-in, sign-up, password reset, webhook receivers, anything callable by anonymous users) MUST be rate-limited before going to production.

The implementation is intentionally deferred — the right backing store depends on the deployment story:

- **Upstash Redis** — best for serverless/multi-region (Vercel, Cloudflare). Single source of truth, low latency from edge.
- **Vercel KV** — fine if already on Vercel; same Redis underneath.
- **In-memory (LRU)** — only useful for single-instance deploys; resets on restart and doesn't share state across replicas.

Decide once, document, apply consistently. Wire decisions through `rateLimit(key, config)`; do not introduce a second helper.

The function signature is stable today; callers can already wrap public endpoints. The current implementation is a no-op (returns `ok(undefined)`) so behavior is preserved until the real backing store lands.

## Usage

```ts
import { rateLimit, RateLimitExceededError } from '@/shared/lib/rate-limit'
import { err } from '@/shared/lib/result'

const limit = await rateLimit(`sign-in:${ip}`, { windowMs: 60_000, max: 5 })
if (!limit.ok) return limit // RateLimitExceededError
```

## DoD

Definition of Done verifies new public endpoints call `rateLimit` before any work. See `docs/dod.md`.

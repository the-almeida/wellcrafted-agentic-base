import { z } from 'zod'

// `.env.example` ships blank values for fields the user fills in later
// (Sentry DSN, PostHog host). `z.url().optional()` accepts only `undefined`
// or a valid URL — empty strings fail validation. Treat empty/whitespace
// as missing so the optional contract holds.
const optionalUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.url().optional(),
)

// Same coercion for optional non-URL strings: an empty `.env` entry should
// mean "feature disabled," not "feature has an empty string." Keeps the
// `if (env.X)` checks elsewhere uniformly correct.
const optionalString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().optional(),
)

const sharedShape = {
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrl,
}

const serverShape = {
  ...sharedShape,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.url(),
  SENTRY_AUTH_TOKEN: optionalString,
  // OAuth provider credentials. Consumed by Supabase via supabase/config.toml's
  // env() indirection, NOT by app code — so they stay optional here. Listed so
  // missing values surface during startup validation instead of at sign-in time.
  GOOGLE_OAUTH_CLIENT_ID: optionalString,
  GOOGLE_OAUTH_CLIENT_SECRET: optionalString,
  FACEBOOK_OAUTH_CLIENT_ID: optionalString,
  FACEBOOK_OAUTH_CLIENT_SECRET: optionalString,
  // Vercel Marketplace Redis (the "Vercel KV" branding). Auto-injected
  // when you provision a Redis store from the Vercel dashboard. Both
  // optional — when absent, rate-limit falls back to an in-memory
  // counter (dev-friendly; not safe for multi-instance prod).
  KV_REST_API_URL: optionalUrl,
  KV_REST_API_TOKEN: optionalString,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Grace period in days before a soft-deleted account is purged by
  // `purge_expired_account_deletions()`. Users can cancel the deletion at
  // any point during this window. Stored as a string in `process.env`;
  // `z.coerce.number()` converts and validates.
  ACCOUNT_DELETION_GRACE_DAYS: z.coerce.number().int().positive().default(30),
}

const serverSchema = z.object(serverShape)
const clientSchema = z.object(sharedShape)

type Env = z.infer<typeof serverSchema>

const isServer = typeof window === 'undefined'

// Each `NEXT_PUBLIC_*` reference below MUST be a literal `process.env.X`
// expression. Next.js's build-time static replacement only rewrites literal
// accesses; passing `process.env` itself (or any dynamic property access)
// yields `undefined` on the client at runtime.
function readPublicEnv() {
  return {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  }
}

function loadEnv(): Env {
  if (process.env.SKIP_ENV_VALIDATION) {
    return { ...readPublicEnv(), ...process.env } as unknown as Env
  }
  if (isServer) {
    const parsed = serverSchema.safeParse({ ...process.env, ...readPublicEnv() })
    if (!parsed.success) {
      console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
      throw new Error('Invalid environment variables')
    }
    return parsed.data as Env
  }
  const parsed = clientSchema.safeParse(readPublicEnv())
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }
  return parsed.data as Env
}

export const env = loadEnv()

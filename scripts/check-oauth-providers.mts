// Runs before `next build` (see the "build" script in package.json). Fails the
// build when the app's active OAuth providers and Supabase Auth disagree, when
// Facebook is active without the secret its data deletion callback needs, when
// the app's anonymous mode and Supabase's anonymous sign-ins disagree, or when
// Supabase cannot be asked. Same rule locally, in CI and on deploys.
//
// Runs with plain Node (type stripping), so it imports only files without
// path aliases or bundler-only syntax.
import { z } from 'zod'

import {
  anonymousSignInsSetup,
  findAnonymousSignInMismatch,
} from '../src/modules/auth/domain/anonymous-sign-ins.ts'
import {
  activeOAuthProviders,
  facebookDataDeletionSetup,
  findProviderMismatches,
} from '../src/modules/auth/domain/oauth-providers.ts'

// Only the part this check relies on. Anything else (an array, a "true"
// string) is not Supabase Auth settings and must not read as "all disabled".
const SettingsSchema = z.object({ external: z.record(z.string(), z.boolean()) })

function fail(lines: string[]): never {
  console.error(['Auth provider check failed:', ...lines.map((line) => `  - ${line}`)].join('\n'))
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
if (!supabaseUrl) fail(['NEXT_PUBLIC_SUPABASE_URL is not set.'])
if (!anonKey) fail(['NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.'])

const settingsUrl = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/settings`

let response: Response
try {
  // Public endpoint of Supabase Auth; the anon key is public too.
  response = await fetch(settingsUrl, {
    headers: { apikey: anonKey },
    // A redirect means the URL is not the Supabase project itself.
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  })
} catch (error) {
  fail([
    `Could not reach ${settingsUrl} (${error instanceof Error ? error.message : String(error)}).`,
    'Locally, start Supabase with `pnpm exec supabase start`. Elsewhere, check NEXT_PUBLIC_SUPABASE_URL.',
  ])
}

if (!response.ok) {
  fail([
    `${settingsUrl} answered ${response.status}.`,
    'Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  ])
}

const parsed = SettingsSchema.safeParse(await response.json().catch(() => undefined))
if (!parsed.success) {
  fail([`${settingsUrl} did not return Supabase Auth settings. Check NEXT_PUBLIC_SUPABASE_URL.`])
}
const { external } = parsed.data

const problems = findProviderMismatches(activeOAuthProviders(process.env), external)
const facebook = facebookDataDeletionSetup(process.env)
if (facebook.status === 'missing-secret') problems.push(facebook.problem)
const anonymous = anonymousSignInsSetup(process.env)
if (anonymous.status === 'invalid') {
  problems.push(anonymous.problem)
} else {
  const mismatch = findAnonymousSignInMismatch(anonymous.enabled, external)
  if (mismatch) problems.push(mismatch)
}
if (problems.length > 0) {
  fail([
    ...problems,
    'The app environment and Supabase must agree; see docs/conventions.md#oauth-providers.',
  ])
}

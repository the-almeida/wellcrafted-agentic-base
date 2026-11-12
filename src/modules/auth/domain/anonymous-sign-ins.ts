// No imports on purpose: scripts/check-oauth-providers.mts runs this file
// directly with Node before `next build`, without the bundler or path aliases.

/**
 * Anonymous mode (see CONTEXT.md: anonymous account) is on unless
 * ANONYMOUS_SIGN_INS_ENABLED is "false". Any other value is reported, not
 * guessed: "no" or "0" turning it on would be the opposite of what was meant.
 */
export type AnonymousSignInsSetup =
  | { status: 'valid'; enabled: boolean }
  | { status: 'invalid'; problem: string }

export function anonymousSignInsSetup(
  env: Readonly<Record<string, unknown>>,
): AnonymousSignInsSetup {
  const raw = env.ANONYMOUS_SIGN_INS_ENABLED
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (value === '' || value === 'true') return { status: 'valid', enabled: true }
  if (value === 'false') return { status: 'valid', enabled: false }
  return {
    status: 'invalid',
    problem: 'ANONYMOUS_SIGN_INS_ENABLED must be "true" or "false" (unset means "true").',
  }
}

/** Whether the app shows the anonymous entry point. An invalid value reads as off. */
export function anonymousSignInsEnabled(env: Readonly<Record<string, unknown>>): boolean {
  const setup = anonymousSignInsSetup(env)
  return setup.status === 'valid' && setup.enabled
}

/**
 * Compares the app's anonymous mode with Supabase Auth's `anonymous_users`
 * (from its public GET /auth/v1/settings). Off in Supabase while on in the
 * app is a button that always fails; on in Supabase while off in the app
 * still lets anyone with the public anon key sign in anonymously.
 */
export function findAnonymousSignInMismatch(
  enabledInApp: boolean,
  supabaseExternal: Readonly<Record<string, boolean>>,
): string | null {
  const inSupabase = supabaseExternal.anonymous_users === true
  if (enabledInApp && !inSupabase) {
    return 'Anonymous sign-ins are disabled in Supabase, but anonymous mode is on in the app (the default). Enable anonymous sign-ins in Supabase, or set ANONYMOUS_SIGN_INS_ENABLED=false.'
  }
  if (!enabledInApp && inSupabase) {
    return 'Anonymous sign-ins are enabled in Supabase, but ANONYMOUS_SIGN_INS_ENABLED=false in the app. Disable them in Supabase, or turn anonymous mode back on.'
  }
  return null
}

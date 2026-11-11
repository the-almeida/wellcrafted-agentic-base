// No imports on purpose: scripts/check-oauth-providers.ts runs this file
// directly with Node before `next build`, without the bundler or path aliases.

export const SUPPORTED_OAUTH_PROVIDERS = ['google', 'facebook'] as const
export type OAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number]

/** How each provider is named to people, on buttons and in messages. */
export const OAUTH_PROVIDER_NAME: Record<OAuthProvider, string> = {
  google: 'Google',
  facebook: 'Facebook',
}

const CLIENT_ID_VARIABLE: Record<OAuthProvider, string> = {
  google: 'GOOGLE_OAUTH_CLIENT_ID',
  facebook: 'FACEBOOK_OAUTH_CLIENT_ID',
}

/**
 * The **active OAuth providers** (see CONTEXT.md): those whose client id is
 * set in the app's environment. Only these get a button on the sign-in and
 * sign-up pages.
 */
export function activeOAuthProviders(env: Readonly<Record<string, unknown>>): OAuthProvider[] {
  return SUPPORTED_OAUTH_PROVIDERS.filter((provider) => {
    const clientId = env[CLIENT_ID_VARIABLE[provider]]
    return typeof clientId === 'string' && clientId.trim() !== ''
  })
}

// Sign-in methods Supabase lists under `external` that are not OAuth
// providers. Anonymous sign-ins belong to the anonymous mode, not to this check.
const NOT_OAUTH = new Set(['email', 'phone', 'anonymous_users'])

function isSupported(name: string): name is OAuthProvider {
  return (SUPPORTED_OAUTH_PROVIDERS as readonly string[]).includes(name)
}

/**
 * Compares the app's active OAuth providers with what Supabase Auth has
 * enabled (`external` from its public GET /auth/v1/settings). Every
 * disagreement is a deploy mistake: a button that fails when clicked, a
 * provider that works but has no button, or a provider the app does not
 * support at all (still usable by calling Supabase directly with the
 * public anon key). Returns one message per problem, empty when they agree.
 */
export function findProviderMismatches(
  active: readonly OAuthProvider[],
  supabaseExternal: Readonly<Record<string, boolean>>,
): string[] {
  const problems: string[] = []
  for (const provider of SUPPORTED_OAUTH_PROVIDERS) {
    const name = OAUTH_PROVIDER_NAME[provider]
    const variable = CLIENT_ID_VARIABLE[provider]
    const inApp = active.includes(provider)
    const inSupabase = supabaseExternal[provider] === true
    if (inSupabase && !inApp) {
      problems.push(
        `${name} is enabled in Supabase, but ${variable} is not set in the app. Set it, or disable ${name} in Supabase.`,
      )
    }
    if (inApp && !inSupabase) {
      problems.push(
        `${variable} is set in the app, but ${name} is disabled in Supabase. Enable it in Supabase, or unset the variable.`,
      )
    }
  }
  const unsupported = Object.keys(supabaseExternal)
    .filter((name) => supabaseExternal[name] === true && !NOT_OAUTH.has(name) && !isSupported(name))
    .sort()
  for (const name of unsupported) {
    problems.push(
      `${name} is enabled in Supabase, but the app does not support it. Disable it in Supabase.`,
    )
  }
  return problems
}

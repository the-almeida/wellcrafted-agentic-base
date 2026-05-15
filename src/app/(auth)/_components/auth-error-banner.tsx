type Context = 'sign-in' | 'sign-up'

type Props = {
  error: string | undefined
  context: Context
}

/**
 * Server-rendered banner shown above the auth forms when a redirect
 * brought the user back with `?error=…`.
 *
 * Copy varies by context:
 * - On /sign-up: the profile-permission hint is shown for
 *   `oauth_failed` because most failures here are first-time users
 *   tripping the trigger's name-required guard (Facebook with
 *   `public_profile` denied, similar Google cases).
 * - On /sign-in: returning users hitting `oauth_failed` aren't usually
 *   missing a profile scope — show a neutral retry message instead.
 *
 * Supabase wraps the trigger's RAISE EXCEPTION as a generic "Database
 * error" so we can't distinguish the cause from the error string;
 * pivoting on the originating page is the next best signal.
 */
export function AuthErrorBanner({ error, context }: Props) {
  if (!error) return null
  const message = resolveMessage(error, context)
  if (!message) return null
  return (
    <p
      role="alert"
      className="border-border bg-background text-foreground rounded-md border px-3 py-2 text-sm"
    >
      {message}
    </p>
  )
}

function resolveMessage(error: string, context: Context): string | null {
  if (error === 'invalid_callback') {
    return 'The sign-in link was invalid or expired. Please try again.'
  }
  if (error === 'too_many_attempts') {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (error === 'oauth_failed') {
    if (context === 'sign-up') {
      return 'Sign-up failed. If you used Google or Facebook, make sure you granted permission to share your name — that field is required to create an account.'
    }
    return 'Sign-in failed. Please try again or use a different method.'
  }
  return null
}

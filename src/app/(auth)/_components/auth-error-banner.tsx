type Props = {
  error: string | undefined
}

const MESSAGES: Record<string, string> = {
  oauth_failed:
    'Sign-in failed. If you used Google or Facebook, make sure you granted permission to share your name — that field is required to create an account.',
  invalid_callback: 'The sign-in link was invalid or expired. Please try again.',
}

/**
 * Server-rendered banner shown above the auth forms when a redirect
 * brought the user back with `?error=…`. Kept presentational so the
 * `oauth_failed` copy stays in one place — it's the catch-all for
 * provider/trigger rejections (including #24's scope-denial case)
 * because Supabase swallows trigger RAISE EXCEPTION messages and
 * surfaces them as a generic "Database error".
 */
export function AuthErrorBanner({ error }: Props) {
  if (!error) return null
  const message = MESSAGES[error]
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

'use client'

import { Button } from '@/shared/ui/button'

import {
  createSupabaseBrowserClient,
  OAUTH_PROVIDER_NAME,
  type OAuthProvider,
} from '@/modules/auth/client'

type Props = {
  /** Active providers only; each gets one button, in this order. */
  providers: readonly OAuthProvider[]
  disabled?: boolean
  /** Same-origin path the user lands on after a successful OAuth exchange. */
  next?: string
  /**
   * Page that initiated this OAuth flow — failures bounce back here so
   * the error banner can render with the right copy. Must match one of
   * the values allow-listed in `oauthCallbackInputSchema`.
   */
  originPath: '/sign-in' | '/sign-up'
  onError: (message: string) => void
}

export function OAuthButtons({
  providers,
  disabled,
  next = '/dashboard',
  originPath,
  onError,
}: Props) {
  async function onOAuth(provider: OAuthProvider) {
    onError('')
    const supabase = createSupabaseBrowserClient()
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
    callbackUrl.searchParams.set('next', next)
    callbackUrl.searchParams.set('from', originPath)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl.toString() },
    })
    if (error) onError(error.message)
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          onClick={() => onOAuth(provider)}
          disabled={disabled}
        >
          Continue with {OAUTH_PROVIDER_NAME[provider]}
        </Button>
      ))}
    </div>
  )
}

'use client'

import { createSupabaseBrowserClient } from '@/modules/auth/client'

type Props = {
  disabled?: boolean
  next?: string
  onError: (message: string) => void
}

export function OAuthButtons({ disabled, next = '/dashboard', onError }: Props) {
  async function onOAuth(provider: 'google' | 'facebook') {
    onError('')
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) onError(error.message)
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onOAuth('google')}
        disabled={disabled}
        className="border-border rounded-md border px-3 py-2 text-sm disabled:opacity-60"
      >
        Continue with Google
      </button>
      <button
        type="button"
        onClick={() => onOAuth('facebook')}
        disabled={disabled}
        className="border-border rounded-md border px-3 py-2 text-sm disabled:opacity-60"
      >
        Continue with Facebook
      </button>
    </div>
  )
}

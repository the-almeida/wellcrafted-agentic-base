'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { signIn, createSupabaseBrowserClient } from '@/modules/auth/client'

export function SignInForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onOAuth(provider: 'google' | 'facebook') {
    setError(null)
    const supabase = createSupabaseBrowserClient()
    startTransition(async () => {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })
      if (oauthError) setError(oauthError.message)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          const formData = new FormData(e.currentTarget)
          const email = String(formData.get('email') ?? '')
          const password = String(formData.get('password') ?? '')
          startTransition(async () => {
            const result = await signIn({ email, password })
            if (!result.ok) {
              setError(result.error.message)
              return
            }
            router.push('/dashboard')
            router.refresh()
          })
        }}
      >
        <label htmlFor="email" className="flex flex-col gap-1 text-sm">
          Email
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="border-border bg-background rounded border px-3 py-2"
          />
        </label>
        <label htmlFor="password" className="flex flex-col gap-1 text-sm">
          Password
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            minLength={8}
            className="border-border bg-background rounded border px-3 py-2"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOAuth('google')}
          disabled={isPending}
          className="border-border rounded-md border px-3 py-2 text-sm disabled:opacity-60"
        >
          Google
        </button>
        <button
          type="button"
          onClick={() => onOAuth('facebook')}
          disabled={isPending}
          className="border-border rounded-md border px-3 py-2 text-sm disabled:opacity-60"
        >
          Facebook
        </button>
      </div>
    </div>
  )
}

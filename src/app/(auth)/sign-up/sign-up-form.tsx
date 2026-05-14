'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { signUp } from '@/modules/auth/client'

export function SignUpForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)
        const email = String(formData.get('email') ?? '')
        const password = String(formData.get('password') ?? '')
        const nameValue = String(formData.get('name') ?? '').trim()
        startTransition(async () => {
          const result = await signUp({
            email,
            password,
            name: nameValue ? nameValue : undefined,
          })
          if (!result.ok) {
            setError(result.error.message)
            return
          }
          router.push('/dashboard')
          router.refresh()
        })
      }}
    >
      <label htmlFor="name" className="flex flex-col gap-1 text-sm">
        Name (optional)
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={120}
          className="border-border bg-background rounded border px-3 py-2"
        />
      </label>
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
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
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
        {isPending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}

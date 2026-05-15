'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { verifyOtp } from '@/modules/auth/client'

type Props = {
  email: string
  onBack: () => void
}

export function OtpVerifyForm({ email, onBack }: Props) {
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
        const token = String(formData.get('token') ?? '').trim()
        startTransition(async () => {
          const result = await verifyOtp({ email, token })
          if (!result.ok) {
            setError(result.error.message)
            return
          }
          router.push('/dashboard')
          router.refresh()
        })
      }}
    >
      <p className="text-muted-foreground text-sm">
        We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span>.
      </p>
      <label htmlFor="token" className="flex flex-col gap-1 text-sm">
        6-digit code
        <input
          id="token"
          name="token"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          pattern="\d{6}"
          minLength={6}
          maxLength={6}
          className="border-border bg-background rounded border px-3 py-2 tracking-widest"
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
        {isPending ? 'Verifying…' : 'Verify'}
      </button>
      <button
        type="button"
        onClick={onBack}
        disabled={isPending}
        className="text-muted-foreground text-xs underline disabled:opacity-60"
      >
        Use a different email
      </button>
    </form>
  )
}

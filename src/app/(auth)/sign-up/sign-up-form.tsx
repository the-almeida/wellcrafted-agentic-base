'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { requestSignUpOtp, signUp } from '@/modules/auth/client'

import { AuthDivider } from '../_components/auth-divider'
import { OAuthButtons } from '../_components/oauth-buttons'
import { OtpVerifyForm } from '../_components/otp-verify-form'

type Stage = { kind: 'choose' } | { kind: 'awaiting-code'; email: string }

export function SignUpForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'choose' })

  function onError(message: string) {
    setError(message || null)
  }

  function onSendCode(email: string, name: string) {
    if (!email || !name) {
      setError('Enter your name and email above first.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await requestSignUpOtp({ email, name })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setStage({ kind: 'awaiting-code', email })
    })
  }

  if (stage.kind === 'awaiting-code') {
    return <OtpVerifyForm email={stage.email} onBack={() => setStage({ kind: 'choose' })} />
  }

  return (
    <div className="flex flex-col gap-4">
      <OAuthButtons disabled={isPending} originPath="/sign-up" onError={onError} />
      <AuthDivider />
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          const formData = new FormData(e.currentTarget)
          const email = String(formData.get('email') ?? '')
          const password = String(formData.get('password') ?? '')
          const name = String(formData.get('name') ?? '').trim()
          startTransition(async () => {
            const result = await signUp({ email, password, name })
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
          Name
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            minLength={1}
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
        <button
          type="button"
          onClick={(e) => {
            const form = e.currentTarget.closest('form')
            const fd = new FormData(form ?? undefined)
            const email = String(fd.get('email') ?? '')
            const name = String(fd.get('name') ?? '').trim()
            onSendCode(email, name)
          }}
          disabled={isPending}
          className="text-muted-foreground text-xs underline disabled:opacity-60"
        >
          Or send me a 6-digit code instead
        </button>
      </form>
    </div>
  )
}

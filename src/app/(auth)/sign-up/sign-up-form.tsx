'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

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
        <div className="flex flex-col gap-1">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            minLength={1}
            maxLength={120}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
          />
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating account…' : 'Create account'}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={(e) => {
            const form = e.currentTarget.closest('form')
            const fd = new FormData(form ?? undefined)
            const email = String(fd.get('email') ?? '')
            const name = String(fd.get('name') ?? '').trim()
            onSendCode(email, name)
          }}
          disabled={isPending}
        >
          Or send me a 6-digit code instead
        </Button>
      </form>
    </div>
  )
}

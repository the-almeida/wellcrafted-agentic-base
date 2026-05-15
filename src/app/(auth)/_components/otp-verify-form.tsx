'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

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
      <div className="flex flex-col gap-1">
        <Label htmlFor="token">6-digit code</Label>
        <Input
          id="token"
          name="token"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          pattern="\d{6}"
          minLength={6}
          maxLength={6}
          className="tracking-widest"
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Verifying…' : 'Verify'}
      </Button>
      <Button type="button" variant="link" size="sm" onClick={onBack} disabled={isPending}>
        Use a different email
      </Button>
    </form>
  )
}

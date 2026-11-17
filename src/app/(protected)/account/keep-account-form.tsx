'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { keepAccount } from '@/modules/auth/client'

/** "Keep your account": an anonymous account adds an email and password. */
export function KeepAccountForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const email = String(formData.get('email') ?? '')
        const password = String(formData.get('password') ?? '')
        setError(null)
        startTransition(async () => {
          const result = await keepAccount({ email, password })
          if (!result.ok) {
            setError(result.error.message)
            return
          }
          router.refresh()
        })
      }}
    >
      <p className="text-muted-foreground text-sm">
        You are using the app without an account. Add an email and password to sign in from any
        device and keep everything you have here. The email is not checked, but without a real one
        we cannot recover the password if you forget it. Signing out before this loses the account.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        Keep my account
      </Button>
    </form>
  )
}

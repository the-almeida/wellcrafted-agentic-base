'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { createSupabaseBrowserClient, NICKNAME_RULE, NicknameSchema } from '@/modules/auth/client'

/**
 * "Continue without an account": asks for a nickname, then signs in
 * anonymously. The sign-in runs in the browser, never in a server action:
 * Supabase limits anonymous sign-ins per IP of the caller, and from the
 * server every visitor would share the server's IPs. The database check on
 * the nickname is the real validation; the schema here only answers early.
 */
export function ContinueWithoutAccount() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Continue without an account
      </Button>
    )
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = NicknameSchema.safeParse(new FormData(e.currentTarget).get('nickname'))
        if (!parsed.success) {
          setError(NICKNAME_RULE)
          return
        }
        setError(null)
        startTransition(async () => {
          const supabase = createSupabaseBrowserClient()
          const { error: signInError } = await supabase.auth.signInAnonymously({
            options: { data: { nickname: parsed.data } },
          })
          if (signInError) {
            setError(
              signInError.status === 429
                ? 'Too many attempts. Wait a minute and try again.'
                : 'Could not continue right now. Try again.',
            )
            return
          }
          router.push('/dashboard')
          router.refresh()
        })
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input id="nickname" name="nickname" autoComplete="nickname" />
        <p className="text-muted-foreground text-xs">
          Others see it with a number, like &ldquo;Wolf #0042&rdquo;. Add an email later to keep the
          account.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        Continue
      </Button>
    </form>
  )
}

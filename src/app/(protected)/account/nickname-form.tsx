'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { NICKNAME_RULE, NicknameSchema, updateNickname } from '@/modules/auth/client'

type Props = {
  /** The current handle ("Wolf #0042"), or null when the account has no profile yet. */
  handle: string | null
  nickname: string | null
}

export function NicknameForm({ handle, nickname }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
          const result = await updateNickname({ nickname: parsed.data })
          if (!result.ok) {
            setError(result.error.message)
            return
          }
          router.refresh()
        })
      }}
    >
      <p className="text-muted-foreground text-sm">
        {handle ? (
          <>
            Others see you as <strong>{handle}</strong>. A new nickname gets a new number.
          </>
        ) : (
          'Pick a nickname to show others.'
        )}
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input
          id="nickname"
          name="nickname"
          defaultValue={nickname ?? ''}
          autoComplete="nickname"
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={isPending}>
        Save nickname
      </Button>
    </form>
  )
}

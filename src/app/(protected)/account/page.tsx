import { redirect } from 'next/navigation'

import { Button } from '@/shared/ui/button'

import {
  displayName,
  formatPublicHandle,
  requireUser,
  requestAccountDeletion,
} from '@/modules/auth'

import { KeepAccountForm } from './keep-account-form'
import { NicknameForm } from './nickname-form'

export const dynamic = 'force-dynamic'

async function handleRequestDeletion() {
  'use server'
  const result = await requestAccountDeletion()
  // Actions return plain `ActionError` data; wrap it so Next's error
  // boundary and Sentry get a real Error with a stack.
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  redirect('/account/pending-deletion')
}

export default async function AccountPage() {
  const userResult = await requireUser({ allow: ['anonymous'] })
  if (!userResult.ok) redirect('/sign-in')

  const user = userResult.value

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Signed in as <strong>{user.email ?? displayName(user)}</strong>.
        </p>
      </header>

      {user.isAnonymous ? (
        <section className="border-border space-y-3 rounded-md border p-4">
          <h2 className="text-lg font-semibold">Keep your account</h2>
          <KeepAccountForm />
        </section>
      ) : null}

      <section className="border-border space-y-3 rounded-md border p-4">
        <h2 className="text-lg font-semibold">Public profile</h2>
        <NicknameForm
          handle={user.profile ? formatPublicHandle(user.profile) : null}
          nickname={user.profile?.nickname ?? null}
        />
      </section>

      <section className="border-border space-y-3 rounded-md border p-4">
        <h2 className="text-lg font-semibold">Delete account</h2>
        <p className="text-muted-foreground text-sm">
          Requesting deletion schedules your account for permanent removal after a grace period. You
          can cancel at any time during that window by signing in.
        </p>
        <form action={handleRequestDeletion}>
          <Button type="submit" variant="destructive">
            Request account deletion
          </Button>
        </form>
      </section>
    </section>
  )
}

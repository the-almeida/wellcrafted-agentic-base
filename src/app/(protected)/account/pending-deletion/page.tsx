import { redirect } from 'next/navigation'

import { Button } from '@/shared/ui/button'

import { ACCOUNT_HOME_PATH, cancelAccountDeletion, requireUser } from '@/modules/auth'
import { signOut } from '@/modules/auth/client'

export const dynamic = 'force-dynamic'

async function handleCancel() {
  'use server'
  const result = await cancelAccountDeletion()
  // Actions return plain `ActionError` data; wrap it so Next's error
  // boundary and Sentry get a real Error with a stack.
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  redirect('/account')
}

async function handleSignOut() {
  'use server'
  await signOut()
  redirect('/sign-in')
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
})

export default async function PendingDeletionPage() {
  // The protected layout already sends users with no active request away
  // from this page, and both read the same per-render resolution. This
  // check is for the type, and in case the layout ever stops running.
  const userResult = await requireUser({ access: 'grace-period' })
  if (!userResult.ok) redirect('/sign-in')

  const pending = userResult.value.pendingDeletion
  if (!pending) redirect(ACCOUNT_HOME_PATH)

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Account scheduled for deletion</h1>
        <p className="text-muted-foreground text-sm">
          Your account will be permanently deleted on{' '}
          <strong>{dateFormatter.format(pending.scheduledFor)} UTC</strong>. Until then, you can
          cancel the deletion and continue using your account normally.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <form action={handleCancel}>
          <Button type="submit">Cancel deletion</Button>
        </form>
        <form action={handleSignOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </section>
  )
}

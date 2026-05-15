import { redirect } from 'next/navigation'

import { Button } from '@/shared/ui/button'

import {
  cancelAccountDeletion,
  getActiveDeletionRequest,
  requireUserAllowPendingDeletion,
} from '@/modules/auth'
import { signOut } from '@/modules/auth/client'

export const dynamic = 'force-dynamic'

async function handleCancel() {
  'use server'
  const result = await cancelAccountDeletion()
  if (!result.ok) throw result.error
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
  // The protected layout already redirects users with no active request
  // away from this page, but render-time defensive reads handle the race
  // where the request is cancelled in another tab between the layout
  // check and this page rendering.
  const userResult = await requireUserAllowPendingDeletion()
  if (!userResult.ok) redirect('/sign-in')

  const active = await getActiveDeletionRequest(userResult.value.id)
  if (!active) redirect('/account')

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Account scheduled for deletion</h1>
        <p className="text-muted-foreground text-sm">
          Your account will be permanently deleted on{' '}
          <strong>{dateFormatter.format(active.scheduledFor)} UTC</strong>. Until then, you can
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

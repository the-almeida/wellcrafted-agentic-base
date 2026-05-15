import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { requireUserAllowPendingDeletion, resolveProtectedRouteRedirect } from '@/modules/auth'

export const dynamic = 'force-dynamic'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Use the bypass variant here: the gated `requireUser` would fail for
  // pending-deletion users with AccountPendingDeletionError, which would
  // bounce them to /sign-in instead of the interstitial. The resolver
  // below handles routing for pending users explicitly.
  const userResult = await requireUserAllowPendingDeletion()
  if (!userResult.ok) redirect('/sign-in')

  const pathname = (await headers()).get('x-pathname') ?? ''
  const redirectTo = await resolveProtectedRouteRedirect(userResult.value.id, pathname)
  if (redirectTo && redirectTo !== pathname) redirect(redirectTo)

  return <main className="min-h-screen p-6">{children}</main>
}

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { requireUser, resolveProtectedRouteRedirect } from '@/modules/auth'

export const dynamic = 'force-dynamic'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Grace-period access: full access would fail for pending-deletion users
  // with AccountPendingDeletionError and bounce them to /sign-in instead of
  // the interstitial. The resolver below routes them explicitly. This only
  // funnels: client-side navigation can skip a shared layout, so each page
  // keeps its own requireUser (cheap: the resolution is cached per render).
  const userResult = await requireUser({ access: 'grace-period' })
  if (!userResult.ok) redirect('/sign-in')

  const pathname = (await headers()).get('x-pathname') ?? ''
  const redirectTo = resolveProtectedRouteRedirect(userResult.value, pathname)
  if (redirectTo && redirectTo !== pathname) redirect(redirectTo)

  return <main className="min-h-screen p-6">{children}</main>
}

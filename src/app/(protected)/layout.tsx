import { redirect } from 'next/navigation'

import { requireUser } from '@/modules/auth'

export const dynamic = 'force-dynamic'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const userResult = await requireUser()
  if (!userResult.ok) redirect('/sign-in')

  return <main className="min-h-screen p-6">{children}</main>
}

import { redirect } from 'next/navigation'

import { requireUser } from '@/modules/auth'
import { signOut } from '@/modules/auth/client'

export const dynamic = 'force-dynamic'

async function handleSignOut() {
  'use server'
  await signOut()
  redirect('/sign-in')
}

export default async function DashboardPage() {
  const userResult = await requireUser()
  if (!userResult.ok) redirect('/sign-in')

  const user = userResult.value

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground mt-2">
        Signed in as <strong>{user.email}</strong>
        {user.name ? ` (${user.name})` : ''}.
      </p>
      <form action={handleSignOut} className="mt-6">
        <button
          type="submit"
          className="border-border rounded-md border px-3 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </form>
    </section>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireUser } from '@/modules/auth'

import { SetPasswordForm } from './set-password-form'

export const dynamic = 'force-dynamic'

/**
 * Shown after the first proof of an older account's email: the account's
 * password was replaced (someone else may have set it before the email was
 * proven), so the person picks a new one, or skips and keeps signing in with
 * emailed codes.
 */
export default async function SetPasswordPage() {
  const userResult = await requireUser()
  if (!userResult.ok) redirect('/sign-in')

  return (
    <section className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="text-muted-foreground text-sm">
        You just confirmed your email, so we signed out every other session and cleared the old
        password, in case someone else set it. Choose a new one to sign in with your email and
        password, or skip and keep signing in with emailed codes.
      </p>
      <SetPasswordForm />
      <Link href="/dashboard" className="text-sm underline">
        Skip for now
      </Link>
    </section>
  )
}

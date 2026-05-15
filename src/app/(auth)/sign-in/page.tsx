import Link from 'next/link'

import { AuthErrorBanner } from '../_components/auth-error-banner'

import { SignInForm } from './sign-in-form'

type Props = {
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams
  const error = Array.isArray(params.error) ? params.error[0] : params.error

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          New here?{' '}
          <Link href="/sign-up" className="underline">
            Create an account
          </Link>
          .
        </p>
      </header>
      <AuthErrorBanner error={error} />
      <SignInForm />
    </div>
  )
}

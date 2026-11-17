import Link from 'next/link'

import { env } from '@/shared/lib/env'

import { activeOAuthProviders, anonymousSignInsEnabled } from '@/modules/auth'

import { AuthDivider } from '../_components/auth-divider'
import { AuthErrorBanner } from '../_components/auth-error-banner'
import { ContinueWithoutAccount } from '../_components/continue-without-account'

import { SignUpForm } from './sign-up-form'

type Props = {
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function SignUpPage({ searchParams }: Props) {
  const params = await searchParams
  const error = Array.isArray(params.error) ? params.error[0] : params.error

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Create an account</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Already registered?{' '}
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>
          .
        </p>
      </header>
      <AuthErrorBanner error={error} context="sign-up" />
      <SignUpForm oauthProviders={activeOAuthProviders(env)} />
      {anonymousSignInsEnabled(env) ? (
        <>
          <AuthDivider />
          <ContinueWithoutAccount />
        </>
      ) : null}
    </div>
  )
}

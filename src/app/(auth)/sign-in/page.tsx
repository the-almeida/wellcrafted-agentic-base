import Link from 'next/link'

import { SignInForm } from './sign-in-form'

export default function SignInPage() {
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
      <SignInForm />
    </div>
  )
}

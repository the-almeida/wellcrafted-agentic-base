import Link from 'next/link'

import { SignUpForm } from './sign-up-form'

export default function SignUpPage() {
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
      <SignUpForm />
    </div>
  )
}

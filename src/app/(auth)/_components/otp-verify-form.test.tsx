import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The server action is the network boundary of this client component, and
// the router comes from Next; neither is exercised by what is rendered.
vi.mock('@/modules/auth/client', () => ({ verifyOtp: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

import { OtpVerifyForm } from './otp-verify-form'

afterEach(() => {
  cleanup()
})

const email = 'someone@example.test'

describe('OtpVerifyForm', () => {
  it('on sign-in, does not claim the email has an account', () => {
    const { container } = render(<OtpVerifyForm flow="sign-in" email={email} onBack={() => {}} />)

    expect(container.textContent).toContain(
      `If an account exists for ${email}, we sent a 6-digit code.`,
    )
    expect(container.textContent).not.toContain('We sent a 6-digit code')
  })

  it('on sign-up, says the code was sent', () => {
    const { container } = render(<OtpVerifyForm flow="sign-up" email={email} onBack={() => {}} />)

    expect(container.textContent).toContain(`We sent a 6-digit code to ${email}.`)
  })
})

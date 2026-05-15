import { expect, test } from '../fixtures/auth'

// Auth specs share state via the local Supabase + Mailpit instances.
// Smoke is single-worker by default in CI; declaring serial keeps it
// honest in local-parallel runs too.
test.describe.configure({ mode: 'serial' })

test.describe('@smoke auth', () => {
  test('sign-in page renders and passes a11y', async ({ page, expectNoA11yViolations }) => {
    await page.goto('/sign-in')
    await expect(page.getByRole('heading')).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('sign-up page renders and passes a11y', async ({ page, expectNoA11yViolations }) => {
    await page.goto('/sign-up')
    await expect(page.getByRole('heading')).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('OTP verify form passes a11y after a code is requested', async ({
    page,
    seedUser,
    expectNoA11yViolations,
  }) => {
    // Trigger the verify view via the sign-in OTP path (no name field
    // needed). Same OtpVerifyForm component renders on /sign-up.
    const user = await seedUser()
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(user.email)
    await page.getByRole('button', { name: 'Or send me a 6-digit code instead' }).click()
    await expect(page.getByLabel('6-digit code')).toBeVisible()
    await expectNoA11yViolations(page)
  })
})

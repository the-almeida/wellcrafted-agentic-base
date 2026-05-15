import { expect, test } from '../fixtures/auth'

// Auth specs share state via the local Supabase + Mailpit instances.
// Running serially within the file keeps cleanup deterministic; other
// spec files still run in parallel via the global `fullyParallel` flag.
test.describe.configure({ mode: 'serial' })

test.describe('OTP sign-up', () => {
  test('new user gets a code, verifies it, and lands on the dashboard', async ({
    page,
    pollOtp,
    uniqueEmail,
  }) => {
    const email = uniqueEmail('otp-signup')
    const name = 'Gary Newuser'

    await page.goto('/sign-up')
    await page.getByLabel('Name').fill(name)
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Or send me a 6-digit code instead' }).click()

    const token = await pollOtp(email)

    await expect(page.getByLabel('6-digit code')).toBeVisible()
    await page.getByLabel('6-digit code').fill(token)
    await page.getByRole('button', { name: 'Verify' }).click()

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()
    await expect(page.getByText(`(${name})`)).toBeVisible()
  })
})

test.describe('OTP sign-in', () => {
  test('seeded user gets a code and signs in', async ({ page, pollOtp, seedUser }) => {
    const user = await seedUser({ name: 'Hannah Existing' })

    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(user.email)
    await page.getByRole('button', { name: 'Or send me a 6-digit code instead' }).click()

    const token = await pollOtp(user.email)

    await expect(page.getByLabel('6-digit code')).toBeVisible()
    await page.getByLabel('6-digit code').fill(token)
    await page.getByRole('button', { name: 'Verify' }).click()

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText(user.email)).toBeVisible()
  })

  test('unknown email shows an error and never receives a code', async ({ page, uniqueEmail }) => {
    const email = uniqueEmail('otp-unknown')

    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(email)
    // Password is required by HTML; fill a dummy so the form validates
    // through to the OTP button without blocking on `required`.
    await page.getByLabel('Password').fill('not-used-for-otp-flow')
    await page.getByRole('button', { name: 'Or send me a 6-digit code instead' }).click()

    // shouldCreateUser=false → adapter returns UnauthenticatedError →
    // form renders the message in its role=alert region.
    await expect(page.getByRole('alert')).toBeVisible()
    // Still on the choose stage; the verify form must NOT have rendered.
    await expect(page.getByLabel('6-digit code')).toHaveCount(0)

    // Settle then confirm Mailpit stayed empty for this address.
    await page.waitForTimeout(1000)
    const list = await fetch(
      `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    )
    const json = (await list.json()) as { messages: unknown[] }
    expect(json.messages).toHaveLength(0)
  })
})

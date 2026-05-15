import { expect, test } from '../fixtures/auth'

// The protected pages share state-affecting actions (request and cancel
// deletion). Keep the spec serial so two workers can't race each other
// and exhaust per-user rate limits or land in inconsistent states.
test.describe.configure({ mode: 'serial' })

test.describe('@smoke account deletion', () => {
  test('/account renders for a signed-in user and passes a11y', async ({
    page,
    seedUser,
    signInAs,
    expectNoA11yViolations,
  }) => {
    const user = await seedUser()
    await signInAs(page, user)

    await page.goto('/account')
    await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Request account deletion' })).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('requesting deletion lands on the interstitial, which passes a11y', async ({
    page,
    seedUser,
    signInAs,
    expectNoA11yViolations,
  }) => {
    const user = await seedUser()
    await signInAs(page, user)

    await page.goto('/account')
    await page.getByRole('button', { name: 'Request account deletion' }).click()
    await page.waitForURL((url) => url.pathname === '/account/pending-deletion')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Account scheduled for deletion' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel deletion' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('any other protected route redirects a pending-deletion user back to the interstitial', async ({
    page,
    seedUser,
    signInAs,
  }) => {
    const user = await seedUser()
    await signInAs(page, user)

    await page.goto('/account')
    await page.getByRole('button', { name: 'Request account deletion' }).click()
    await page.waitForURL((url) => url.pathname === '/account/pending-deletion')

    await page.goto('/dashboard')
    await page.waitForURL((url) => url.pathname === '/account/pending-deletion')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Account scheduled for deletion' }),
    ).toBeVisible()
  })
})

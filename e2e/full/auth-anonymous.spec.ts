import { expect, test } from '../fixtures/auth'

test.describe('Continue without an account', () => {
  test('asks for a nickname, then lands on the dashboard as "Nickname #NNNN"', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByRole('button', { name: 'Continue without an account' }).click()
    await page.getByLabel('Nickname').fill('Wolf')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText(/Signed in as Wolf #\d{4}\./)).toBeVisible()
  })

  test('is offered on the sign-up page too', async ({ page }) => {
    await page.goto('/sign-up')

    await expect(page.getByRole('button', { name: 'Continue without an account' })).toBeVisible()
  })

  test('refuses an invalid nickname without creating a session', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByRole('button', { name: 'Continue without an account' }).click()
    await page.getByLabel('Nickname').fill('!')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page.locator('form').getByRole('alert')).toContainText('2 to 24 characters')
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/sign-in/)
  })
})

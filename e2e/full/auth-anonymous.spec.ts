import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/auth'

async function continueAnonymously(page: Page, nickname: string) {
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'Continue without an account' }).click()
  await page.getByLabel('Nickname').fill(nickname)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

test.describe('Continue without an account', () => {
  test('asks for a nickname, then lands on the dashboard as "Nickname #NNNN"', async ({ page }) => {
    await continueAnonymously(page, 'Wolf')

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

test.describe('Anonymous account page', () => {
  test('changes the nickname', async ({ page }) => {
    await continueAnonymously(page, 'Wolf')
    await page.goto('/account')

    await page.getByLabel('Nickname').fill('Fox')
    await page.getByRole('button', { name: 'Save nickname' }).click()

    await expect(page.getByText(/Fox #\d{4}/).first()).toBeVisible()
    await page.goto('/dashboard')
    await expect(page.getByText(/Signed in as Fox #\d{4}\./)).toBeVisible()
  })

  test('keeps the account with an email and password, usable to sign in later', async ({
    page,
    uniqueEmail,
  }) => {
    const email = uniqueEmail('keep')
    await continueAnonymously(page, 'Owl')
    await page.goto('/account')

    await expect(page.getByText(/cannot recover the password/i)).toBeVisible()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('kept-password-1')
    await page.getByRole('button', { name: 'Keep my account' }).click()
    await expect(page.getByText(`Signed in as ${email}.`)).toBeVisible()

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('kept-password-1')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    // Same account: the email it was kept with, and the profile it had as a guest.
    const signedInAs = page.getByText(`Signed in as ${email}`)
    await expect(signedInAs).toBeVisible()
    await expect(signedInAs).toContainText(/\(Owl #\d{4}\)/)
  })
})

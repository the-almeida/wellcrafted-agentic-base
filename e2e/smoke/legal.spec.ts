import { expect, test } from '../fixtures/auth'

test.describe('@smoke legal pages', () => {
  for (const [path, heading] of [
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Service'],
    ['/data-deletion', 'Account & Data Deletion'],
  ] as const) {
    test(`${path} renders, links the legal trio in the footer, and passes a11y`, async ({
      page,
      expectNoA11yViolations,
    }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()

      const footer = page.getByRole('contentinfo')
      await expect(footer.getByRole('link', { name: 'Privacy Policy' })).toBeVisible()
      await expect(footer.getByRole('link', { name: 'Terms of Service' })).toBeVisible()
      await expect(footer.getByRole('link', { name: 'Data Deletion' })).toBeVisible()

      await expectNoA11yViolations(page)
    })
  }

  test('legal pages contain the LGPD/GDPR placeholders an OAuth reviewer expects', async ({
    page,
  }) => {
    await page.goto('/privacy')
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/Data Protection Officer/)
    expect(body).toMatch(/LGPD/)
    expect(body).toMatch(/GDPR/)
    // Placeholders for forkers to replace
    expect(body).toMatch(/\{\{COMPANY_NAME\}\}/)
    expect(body).toMatch(/\{\{DPO_EMAIL\}\}/)
  })

  test('data deletion status page renders a generic message for an unknown code', async ({
    page,
  }) => {
    await page.goto('/data-deletion/status?code=does-not-exist-anywhere')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Data Deletion Status' }),
    ).toBeVisible()
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/processed or could not be found/)
  })

  test('data deletion status page renders the same generic message with no code at all', async ({
    page,
  }) => {
    await page.goto('/data-deletion/status')
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/processed or could not be found/)
  })

  test('data deletion status page is noindex', async ({ page }) => {
    await page.goto('/data-deletion/status?code=anything')
    const robots = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robots).toMatch(/noindex/)
  })
})

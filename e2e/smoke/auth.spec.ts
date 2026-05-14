import { test, expect } from '../fixtures/axe'

test.describe('@smoke auth', () => {
  test('sign-in page renders and passes a11y', async ({ page, expectNoA11yViolations }) => {
    await page.goto('/sign-in')
    await expect(page.getByRole('heading')).toBeVisible()
    await expectNoA11yViolations(page)
  })
})

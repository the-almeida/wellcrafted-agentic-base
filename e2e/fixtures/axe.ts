import AxeBuilder from '@axe-core/playwright'
import { test as base, expect, type Page } from '@playwright/test'

type Fixtures = {
  expectNoA11yViolations: (page: Page) => Promise<void>
}

export const test = base.extend<Fixtures>({
  expectNoA11yViolations: async ({}, use) => {
    await use(async (page: Page) => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
      const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(critical, JSON.stringify(critical, null, 2)).toEqual([])
    })
  },
})

export { expect }

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from '@playwright/test'

// Playwright doesn't auto-load `.env.local` into `process.env`. The
// e2e fixtures need SUPABASE_SERVICE_ROLE_KEY and friends to seed
// users and scrape Mailpit, so parse the file the same way
// vitest.config.mts does. Real `process.env` values still win.
const envLocalPath = resolve(process.cwd(), '.env.local')
if (existsSync(envLocalPath)) {
  for (const line of readFileSync(envLocalPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['github']] : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    // CI reuses the build step from the prior CI job. Locally, Playwright
    // builds and starts the app itself.
    command: process.env.CI ? 'pnpm start' : 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

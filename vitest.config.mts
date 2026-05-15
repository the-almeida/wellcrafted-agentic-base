import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

// Vite 8 resolves `paths` from tsconfig natively, so the `vite-tsconfig-paths`
// plugin is no longer needed.
const resolveTsconfigPaths = { tsconfigPaths: true }

// Integration tests hit the local Supabase stack and need DATABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, etc. from `.env.local`. Vitest does not load
// `.env*` files into `process.env` (Vite only exposes them via
// `import.meta.env` with the `VITE_` prefix). Parse `.env.local` here so
// the env module's startup validation finds the values when the worker
// boots. Real `process.env` values still win.
const envLocalPath = resolve(process.cwd(), '.env.local')
if (existsSync(envLocalPath)) {
  const content = readFileSync(envLocalPath, 'utf8')
  for (const line of content.split('\n')) {
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
  resolve: resolveTsconfigPaths,
  test: {
    projects: [
      {
        resolve: resolveTsconfigPaths,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['src/**/*.integration.test.ts'],
          environment: 'node',
          globals: false,
        },
      },
      {
        resolve: resolveTsconfigPaths,
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          environment: 'node',
          globals: false,
          setupFiles: ['./src/shared/db/test-setup.ts'],
        },
      },
    ],
  },
})

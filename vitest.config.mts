import { defineConfig } from 'vitest/config'

// Vite 8 resolves `paths` from tsconfig natively, so the `vite-tsconfig-paths`
// plugin is no longer needed.
const resolveTsconfigPaths = { tsconfigPaths: true }

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

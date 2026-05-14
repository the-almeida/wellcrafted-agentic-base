import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import boundaries from 'eslint-plugin-boundaries'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
    'node_modules/**',
    'supabase/**',
  ]),
  {
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**/*' },
        { type: 'proxy', pattern: 'src/proxy.ts', mode: 'file' },
        { type: 'module', pattern: 'src/modules/*', mode: 'folder' },
        { type: 'shared-ui', pattern: 'src/shared/ui/**/*' },
        { type: 'shared-lib', pattern: 'src/shared/lib/**/*' },
        { type: 'shared-db', pattern: 'src/shared/db/**/*' },
        { type: 'shared-obs', pattern: 'src/shared/observability/**/*' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            // app may import modules (only via index.ts / client.ts) and shared-*
            {
              from: { type: 'app' },
              allow: {
                to: { type: ['shared-ui', 'shared-lib', 'shared-db', 'shared-obs'] },
              },
            },
            {
              from: { type: 'app' },
              allow: {
                to: { type: 'module', internalPath: '(index|client).ts' },
              },
            },
            // proxy (Next 16, formerly middleware) may import modules via public surface, plus shared lib/obs
            {
              from: { type: 'proxy' },
              allow: { to: { type: ['shared-lib', 'shared-obs'] } },
            },
            {
              from: { type: 'proxy' },
              allow: {
                to: { type: 'module', internalPath: '(index|client).ts' },
              },
            },
            // modules may import shared-*; cross-module imports go through
            // the public surface only (index.ts / client.ts). Intra-module
            // imports are auto-allowed (same element, doesn't cross a boundary).
            {
              from: { type: 'module' },
              allow: {
                to: { type: ['shared-ui', 'shared-lib', 'shared-db', 'shared-obs'] },
              },
            },
            {
              from: { type: 'module' },
              allow: {
                to: { type: 'module', internalPath: '(index|client).ts' },
              },
            },
            // shared-* may import other shared-*
            {
              from: { type: ['shared-ui', 'shared-lib', 'shared-db', 'shared-obs'] },
              allow: {
                to: { type: ['shared-ui', 'shared-lib', 'shared-db', 'shared-obs'] },
              },
            },
          ],
        },
      ],
      'import/no-cycle': ['error', { maxDepth: 10 }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            { pattern: '@/shared/**', group: 'internal', position: 'before' },
            { pattern: '@/modules/**', group: 'internal', position: 'after' },
          ],
          pathGroupsExcludedImportTypes: ['builtin', 'external'],
          'newlines-between': 'always',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/utils/**'], message: 'Use shared/lib/<category>/ instead' },
            { group: ['**/common/**'], message: 'Use shared/lib/<category>/ instead' },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='getSession']",
          message:
            'getSession() does not verify the JWT. Use getUser() for authorization (see docs/architecture.md).',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['e2e/**/*.ts'],
    rules: {
      // Playwright's fixture API uses `use` — collides with react-hooks naming rule.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
])

export default eslintConfig

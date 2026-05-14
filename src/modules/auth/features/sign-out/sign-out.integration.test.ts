import { describe, it } from 'vitest'

// Integration tests require Supabase local + the auth mock helpers.
// Wired up by `src/shared/db/test-setup.ts` once the test infra is finalized.
describe.skip('sign-out integration', () => {
  it.todo('clears the Supabase session cookie')
})

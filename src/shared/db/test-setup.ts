import { afterAll, beforeAll, beforeEach } from 'vitest'

/**
 * Integration test setup.
 *
 * Loaded by vitest for `*.integration.test.ts` files. Phase 3 wires this
 * to a Supabase-local test database and the auth mock helpers. Until then,
 * it's a no-op so the project boots cleanly.
 */
beforeAll(async () => {
  // TODO: connect to test DB / seed minimal fixtures
})

beforeEach(async () => {
  // TODO: reset to a known state between tests
})

afterAll(async () => {
  // TODO: close DB connection
})

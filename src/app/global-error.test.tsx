import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// posthog-js is the external analytics SDK (the port boundary); the app's
// own `track.client` runs for real.
const capture = vi.fn()
vi.mock('posthog-js', () => ({
  default: { init: vi.fn(), capture, identify: vi.fn(), reset: vi.fn() },
}))

describe('global error page', () => {
  beforeEach(() => {
    capture.mockClear()
    window.history.pushState({}, '', '/dashboard')
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  // The fresh import loads the page's whole module graph: about 2 s alone,
  // past the default 5 s while the full suite loads the machine.
  it('reports critical_error_shown with the page and the error digest', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
    const { default: GlobalError } = await import('./global-error')

    render(<GlobalError error={Object.assign(new Error('boom'), { digest: 'abc123' })} />)

    expect(capture).toHaveBeenCalledWith('critical_error_shown', {
      page: '/dashboard',
      code: 'abc123',
    })
  }, 20_000)
})

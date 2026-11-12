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

  it('reports critical_error_shown with the page and the error digest', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
    const { default: GlobalError } = await import('./global-error')

    // GlobalError renders its own <html>, so it mounts on the document.
    render(<GlobalError error={Object.assign(new Error('boom'), { digest: 'abc123' })} />, {
      container: document,
    })

    expect(capture).toHaveBeenCalledWith('critical_error_shown', {
      page: '/dashboard',
      code: 'abc123',
    })
  })
})

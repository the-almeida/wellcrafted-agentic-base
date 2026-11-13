import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// posthog-js is the external analytics SDK (the port boundary); the app's
// own `track.client` runs for real.
const capture = vi.fn()
vi.mock('posthog-js', () => ({
  default: { init: vi.fn(), capture, identify: vi.fn(), reset: vi.fn() },
}))

async function renderErrorPage(error: Error & { digest?: string }) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
  const { default: ErrorPage } = await import('./error')
  render(<ErrorPage error={error} reset={() => {}} />)
}

describe('app error page', () => {
  beforeEach(() => {
    capture.mockClear()
    window.history.pushState({}, '', '/dashboard')
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  // The first fresh import of the page loads its whole module graph: about
  // 2 s alone, past the default 5 s while the full suite loads the machine.
  it('reports critical_error_shown with the page and the error digest', async () => {
    await renderErrorPage(Object.assign(new Error('boom'), { digest: 'abc123' }))

    expect(capture).toHaveBeenCalledWith('critical_error_shown', {
      page: '/dashboard',
      code: 'abc123',
    })
  }, 20_000)

  it("reports code 'client' for an error thrown in the browser, which has no digest", async () => {
    await renderErrorPage(new Error('boom'))

    expect(capture).toHaveBeenCalledWith(
      'critical_error_shown',
      expect.objectContaining({ code: 'client' }),
    )
  })

  it('reports the page without its query string', async () => {
    window.history.pushState({}, '', '/data-deletion/status?code=secret-confirmation-code')

    await renderErrorPage(new Error('boom'))

    expect(capture).toHaveBeenCalledWith(
      'critical_error_shown',
      expect.objectContaining({ page: '/data-deletion/status' }),
    )
  })
})

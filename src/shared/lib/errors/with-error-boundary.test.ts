import { describe, expect, it } from 'vitest'

import { RateLimitExceededError } from '@/shared/lib/rate-limit'
import { err, ok } from '@/shared/lib/result'

import { AccountPendingDeletionError, ForbiddenError, ValidationError } from './base'
import { withErrorBoundary } from './with-error-boundary'

// React Flight (the server action transport) does not serialize Error
// instances: in production builds a returned Error arrives in the browser
// as a generic "An error occurred in the Server Components render" Error
// with `code` and every other own field dropped. The boundary must hand the
// client plain objects. `structuredClone` + JSON round-trips stand in for
// "survives a serializer that only understands plain data".
function expectPlainData(value: unknown) {
  expect(Object.getPrototypeOf(value)).toBe(Object.prototype)
  expect(value).not.toBeInstanceOf(Error)
}

describe('withErrorBoundary', () => {
  it('passes ok results through unchanged', async () => {
    const action = withErrorBoundary(async () => ok({ id: 'abc' }))

    expect(await action()).toEqual({ ok: true, value: { id: 'abc' } })
  })

  it('returns expected errors as plain objects carrying code and message', async () => {
    const action = withErrorBoundary(async () => err(new ForbiddenError('cannot update post 1')))

    const result = await action()

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected an error result')
    expectPlainData(result.error)
    expect(result.error).toEqual({ code: 'FORBIDDEN', message: 'cannot update post 1' })
    expect(JSON.parse(JSON.stringify(result.error))).toEqual(result.error)
  })

  it('keeps validation details so forms can show field errors', async () => {
    const details = { fieldErrors: { email: ['Invalid email'] }, formErrors: [] }
    const action = withErrorBoundary(async () => err(new ValidationError(details)))

    const result = await action()

    if (result.ok) throw new Error('expected an error result')
    expectPlainData(result.error)
    expect(result.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details,
    })
  })

  it('keeps scheduledFor on pending-deletion errors', async () => {
    const scheduledFor = new Date('2030-01-01T00:00:00.000Z')
    const action = withErrorBoundary(async () => err(new AccountPendingDeletionError(scheduledFor)))

    const result = await action()

    if (result.ok) throw new Error('expected an error result')
    expectPlainData(result.error)
    expect(structuredClone(result.error)).toEqual({
      code: 'ACCOUNT_PENDING_DELETION',
      message: 'Account is scheduled for deletion',
      scheduledFor,
    })
  })

  it('returns rate-limit errors as plain objects without leaking the limiter key', async () => {
    const action = withErrorBoundary(async () =>
      err(new RateLimitExceededError('sign-in:email:alice@example.com')),
    )

    const result = await action()

    if (result.ok) throw new Error('expected an error result')
    expectPlainData(result.error)
    expect(result.error).toEqual({ code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' })
  })

  it('re-throws unexpected exceptions so Next renders its error boundary', async () => {
    const bug = new Error('invariant violated')
    const action = withErrorBoundary(async () => {
      throw bug
    })

    await expect(action()).rejects.toBe(bug)
  })
})

import { AuthApiError, AuthRetryableFetchError, AuthUnknownError } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { logger } from '@/shared/observability/logger'

import { AUTH_ERROR_MESSAGES } from '../ports/auth-provider'

import { mapSupabaseAuthError } from './supabase-auth-errors'

// Real auth-js error instances, the same ones the SDK returns (no mocks).

afterEach(() => {
  vi.restoreAllMocks()
})

const as = (code: string, message: string) => expect.objectContaining({ code, message })

describe('mapSupabaseAuthError', () => {
  it.each([
    [
      'sign-in',
      new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
      as('UNAUTHENTICATED', AUTH_ERROR_MESSAGES.invalidCredentials),
    ],
    [
      'verify',
      new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
      as('UNAUTHENTICATED', AUTH_ERROR_MESSAGES.invalidCode),
    ],
    [
      'sign-up',
      new AuthApiError('User already registered', 422, 'user_already_exists'),
      as('EXTERNAL_SERVICE_ERROR', AUTH_ERROR_MESSAGES.signUpFailed),
    ],
  ] as const)(
    '%s: maps the expected Supabase failure to a fixed message',
    (op, error, expected) => {
      const mapped = mapSupabaseAuthError(op, error)

      expect(mapped).toEqual(expected)
      expect(mapped.cause).toBe(error)
    },
  )

  it('treats an expected code with a 5xx status as an outage', () => {
    const mapped = mapSupabaseAuthError(
      'sign-in',
      new AuthApiError('x', 500, 'invalid_credentials'),
    )

    expect(mapped).toEqual(as('EXTERNAL_SERVICE_ERROR', AUTH_ERROR_MESSAGES.unavailable))
  })

  it.each([
    ['a 429 without a code', new AuthApiError('Too Many Requests', 429, undefined)],
    [
      'the rate-limit code on another status',
      new AuthApiError('Rate limited', 400, 'over_request_rate_limit'),
    ],
  ])('recognizes a Supabase rate limit from %s', (_label, original) => {
    expect(mapSupabaseAuthError('sign-in', original)).toEqual(
      as('RATE_LIMIT_EXCEEDED', AUTH_ERROR_MESSAGES.tooManyAttempts),
    )
  })

  it.each(['sign-in', 'sign-up', 'otp-request', 'verify', 'sign-out'] as const)(
    '%s: maps a Supabase rate limit to RATE_LIMIT_EXCEEDED, keeping the original as cause',
    (op) => {
      const original = new AuthApiError(
        'Request rate limit reached',
        429,
        'over_request_rate_limit',
      )

      const mapped = mapSupabaseAuthError(op, original)

      expect(mapped).toEqual(as('RATE_LIMIT_EXCEEDED', AUTH_ERROR_MESSAGES.tooManyAttempts))
      expect(mapped.cause).toBe(original)
    },
  )

  it.each([
    ['no response', new AuthRetryableFetchError('fetch failed', 0)],
    ['503', new AuthRetryableFetchError('Service Unavailable', 503)],
    ['a body that is not JSON', new AuthUnknownError('Unexpected token <', null)],
    ['a 500', new AuthApiError('Database error saving new user', 500, 'unexpected_failure')],
  ])('maps an outage (%s) to the generic unavailable error', (_label, original) => {
    const mapped = mapSupabaseAuthError('sign-in', original)

    expect(mapped).toEqual(as('EXTERNAL_SERVICE_ERROR', AUTH_ERROR_MESSAGES.unavailable))
    expect(mapped.cause).toBe(original)
  })

  it.each([
    ['weak_password', 'Password should be at least 6 characters'],
    ['email_address_invalid', 'Email address "x" is invalid'],
    ['signup_disabled', 'Signups not allowed for this instance'],
  ])('never passes an unmapped Supabase message through (%s)', (code, message) => {
    const mapped = mapSupabaseAuthError('sign-up', new AuthApiError(message, 422, code))

    expect(mapped).toEqual(as('EXTERNAL_SERVICE_ERROR', AUTH_ERROR_MESSAGES.unavailable))
  })

  it('logs operational failures with code and status only, never the email', () => {
    const warned = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const errored = vi.spyOn(logger, 'error').mockImplementation(() => undefined)

    mapSupabaseAuthError('sign-in', new AuthApiError('rate limit', 429, 'over_request_rate_limit'))
    mapSupabaseAuthError('sign-in', new AuthRetryableFetchError('fetch failed', 0))
    mapSupabaseAuthError(
      'sign-up',
      new AuthApiError('Email a@b.c is invalid', 422, 'email_address_invalid'),
    )

    expect(warned).toHaveBeenCalledWith(
      { source: 'supabase', op: 'sign-in', code: 'over_request_rate_limit', status: 429 },
      expect.any(String),
    )
    expect(errored).toHaveBeenCalledWith(
      { source: 'supabase', op: 'sign-in', code: undefined, status: 0 },
      expect.any(String),
    )
    expect(errored).toHaveBeenCalledWith(
      { source: 'supabase', op: 'sign-up', code: 'email_address_invalid', status: 422 },
      expect.any(String),
    )
    expect(JSON.stringify([warned.mock.calls, errored.mock.calls])).not.toContain('a@b.c')
  })

  it('does not log wrong credentials or codes (normal traffic)', () => {
    const warned = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const errored = vi.spyOn(logger, 'error').mockImplementation(() => undefined)

    mapSupabaseAuthError(
      'sign-in',
      new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    )
    mapSupabaseAuthError(
      'verify',
      new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
    )

    expect(warned).not.toHaveBeenCalled()
    expect(errored).not.toHaveBeenCalled()
  })
})

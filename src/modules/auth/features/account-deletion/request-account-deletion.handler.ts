'use server'

import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { rateLimit } from '@/shared/lib/rate-limit'

import { accountDeletionPolicy } from '../../domain/policy'
import { requireUserAllowPendingDeletion } from '../../require-user'

import { requestAccountDeletionForUser } from './request-account-deletion.logic'

export const requestAccountDeletion = withErrorBoundary(async () => {
  const userResult = await requireUserAllowPendingDeletion()
  if (!userResult.ok) return userResult

  const authz = accountDeletionPolicy(userResult.value, { type: 'request' })
  if (!authz.ok) return authz

  // Bound how much an authenticated user can grow the audit table by
  // looping request -> cancel -> request. Each new request inserts a
  // row; the idempotent "active request already exists" path still
  // costs against this bucket, which is intentional (it protects DB
  // and HMAC CPU even when no row is written).
  const limit = await rateLimit(`account-deletion:request:${userResult.value.id}`, {
    windowMs: 60 * 60 * 1000,
    max: 5,
  })
  if (!limit.ok) return limit

  return requestAccountDeletionForUser(userResult.value)
})

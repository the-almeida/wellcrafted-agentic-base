'use server'

import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'

import { accountDeletionPolicy } from '../../domain/policy'
import { requireUserAllowPendingDeletion } from '../../require-user'

import { cancelAccountDeletionForUser } from './cancel-account-deletion.logic'

export const cancelAccountDeletion = withErrorBoundary(async () => {
  const userResult = await requireUserAllowPendingDeletion()
  if (!userResult.ok) return userResult

  const authz = accountDeletionPolicy(userResult.value, { type: 'cancel' })
  if (!authz.ok) return authz

  return cancelAccountDeletionForUser(userResult.value)
})

'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { err } from '@/shared/lib/result'

import { requireUser } from '@/modules/auth'

import { updateExampleEntityFor } from './update-example-entity.logic'
import { updateExampleEntitySchema } from './update-example-entity.schema'

export const updateExampleEntity = withErrorBoundary(async (raw: unknown) => {
  const userResult = await requireUser()
  if (!userResult.ok) return userResult

  const parsed = updateExampleEntitySchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  return updateExampleEntityFor(userResult.value, parsed.data)
})

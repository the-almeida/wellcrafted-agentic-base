'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { err } from '@/shared/lib/result'

import { requireUser } from '@/modules/auth'

import { deleteExampleEntityFor } from './delete-example-entity.logic'
import { deleteExampleEntitySchema } from './delete-example-entity.schema'

export const deleteExampleEntity = withErrorBoundary(async (raw: unknown) => {
  const userResult = await requireUser()
  if (!userResult.ok) return userResult

  const parsed = deleteExampleEntitySchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  return deleteExampleEntityFor(userResult.value, parsed.data)
})

'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { err } from '@/shared/lib/result'

import { requireUser } from '@/modules/auth'

import { createExampleEntityFor } from './create-example-entity.logic'
import { createExampleEntitySchema } from './create-example-entity.schema'

export const createExampleEntity = withErrorBoundary(async (raw: unknown) => {
  const userResult = await requireUser()
  if (!userResult.ok) return userResult

  const parsed = createExampleEntitySchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  return createExampleEntityFor(userResult.value, parsed.data)
})

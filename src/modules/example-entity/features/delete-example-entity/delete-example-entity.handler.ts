'use server'

import { NotFoundError, ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { err, ok } from '@/shared/lib/result'

import { requireUser } from '@/modules/auth'

import { exampleEntityRepository } from '../../adapters/example-entity-repository.drizzle'
import { examplePolicy } from '../../domain/policy'

import { deleteExampleEntitySchema } from './delete-example-entity.schema'

export const deleteExampleEntity = withErrorBoundary(async (raw: unknown) => {
  const userResult = await requireUser()
  if (!userResult.ok) return userResult

  const parsed = deleteExampleEntitySchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  const entity = await exampleEntityRepository.findById(parsed.data.id)
  if (!entity) return err(new NotFoundError('example entity not found'))

  const authz = examplePolicy(userResult.value, { type: 'delete', entity })
  if (!authz.ok) return authz

  await exampleEntityRepository.delete(entity.id)
  return ok(undefined)
})

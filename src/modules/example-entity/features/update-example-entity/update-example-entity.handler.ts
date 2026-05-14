'use server'

import { NotFoundError, ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { err, ok } from '@/shared/lib/result'

import { requireUser } from '@/modules/auth'

import { exampleEntityRepository } from '../../adapters/example-entity-repository.drizzle'
import { examplePolicy } from '../../domain/policy'

import { updateExampleEntitySchema } from './update-example-entity.schema'

export const updateExampleEntity = withErrorBoundary(async (raw: unknown) => {
  const userResult = await requireUser()
  if (!userResult.ok) return userResult

  const parsed = updateExampleEntitySchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  // Critical: load the entity from the DB. Trusting the client's view of
  // ownership lets them impersonate any owner.
  const entity = await exampleEntityRepository.findById(parsed.data.id)
  if (!entity) return err(new NotFoundError('example entity not found'))

  const authz = examplePolicy(userResult.value, { type: 'update', entity })
  if (!authz.ok) return authz

  const updated = await exampleEntityRepository.update(entity.id, {
    title: parsed.data.title,
    description: parsed.data.description,
  })

  return ok(updated)
})

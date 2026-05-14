'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { err, ok } from '@/shared/lib/result'

import { requireUser } from '@/modules/auth'

import { exampleEntityRepository } from '../../adapters/example-entity-repository.drizzle'
import { examplePolicy } from '../../domain/policy'

import { createExampleEntitySchema } from './create-example-entity.schema'

export const createExampleEntity = withErrorBoundary(async (raw: unknown) => {
  const userResult = await requireUser()
  if (!userResult.ok) return userResult

  const parsed = createExampleEntitySchema.safeParse(raw)
  if (!parsed.success) {
    return err(new ValidationError(parsed.error.flatten()))
  }

  const authz = examplePolicy(userResult.value, { type: 'create' })
  if (!authz.ok) return authz

  const entity = await exampleEntityRepository.create({
    userId: userResult.value.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
  })

  return ok(entity)
})

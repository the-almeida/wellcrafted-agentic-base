import { ok, type Result } from '@/shared/lib/result'
import type { ForbiddenError } from '@/shared/lib/errors/base'

import type { User } from '@/modules/auth'

import { exampleEntityRepository } from '../../adapters/example-entity-repository.drizzle'
import type { ExampleEntity } from '../../domain/example-entity'
import { examplePolicy } from '../../domain/policy'

import type { CreateExampleEntityInput } from './create-example-entity.schema'

/**
 * The work behind `createExampleEntity`, for a user the handler already
 * authenticated. The owner is always the caller, never the input.
 */
export async function createExampleEntityFor(
  user: User,
  input: CreateExampleEntityInput,
): Promise<Result<ExampleEntity, ForbiddenError>> {
  const authz = examplePolicy(user, { type: 'create' })
  if (!authz.ok) return authz

  const entity = await exampleEntityRepository.create({
    userId: user.id,
    title: input.title,
    description: input.description ?? null,
  })
  return ok(entity)
}

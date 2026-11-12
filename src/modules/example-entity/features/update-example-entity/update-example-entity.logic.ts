import { NotFoundError, type ForbiddenError } from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'

import type { User } from '@/modules/auth'

import { exampleEntityRepository } from '../../adapters/example-entity-repository.drizzle'
import type { ExampleEntity } from '../../domain/example-entity'
import { examplePolicy } from '../../domain/policy'

import type { UpdateExampleEntityInput } from './update-example-entity.schema'

/**
 * The work behind `updateExampleEntity`. Unlike create, the policy runs
 * here and not in the handler: it needs the entity, which must come from
 * the database (trusting the client's view of ownership would let anyone
 * impersonate any owner).
 */
export async function updateExampleEntityFor(
  user: User,
  input: UpdateExampleEntityInput,
): Promise<Result<ExampleEntity, NotFoundError | ForbiddenError>> {
  const entity = await exampleEntityRepository.findById(input.id)
  if (!entity) return err(new NotFoundError('example entity not found'))

  const authz = examplePolicy(user, { type: 'update', entity })
  if (!authz.ok) return authz

  const updated = await exampleEntityRepository.update(entity.id, {
    title: input.title,
    description: input.description,
  })
  return ok(updated)
}

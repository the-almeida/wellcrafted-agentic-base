import { NotFoundError, type ForbiddenError } from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'

import type { User } from '@/modules/auth'

import { exampleEntityRepository } from '../../adapters/example-entity-repository.drizzle'
import { examplePolicy } from '../../domain/policy'

import type { DeleteExampleEntityInput } from './delete-example-entity.schema'

/**
 * The work behind `deleteExampleEntity`. The policy runs here because it
 * needs the entity loaded from the database (see update's logic).
 */
export async function deleteExampleEntityFor(
  user: User,
  input: DeleteExampleEntityInput,
): Promise<Result<void, NotFoundError | ForbiddenError>> {
  const entity = await exampleEntityRepository.findById(input.id)
  if (!entity) return err(new NotFoundError('example entity not found'))

  const authz = examplePolicy(user, { type: 'delete', entity })
  if (!authz.ok) return authz

  await exampleEntityRepository.delete(entity.id)
  return ok(undefined)
}

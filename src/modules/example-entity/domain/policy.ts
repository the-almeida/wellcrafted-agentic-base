import { ForbiddenError } from '@/shared/lib/errors/base'
import { err, ok } from '@/shared/lib/result'

import { isAdmin, type Policy } from '@/modules/auth'

import type { ExampleEntity } from './example-entity'

export type ExampleAction =
  | { type: 'create' }
  | { type: 'read'; entity: ExampleEntity }
  | { type: 'update'; entity: ExampleEntity }
  | { type: 'delete'; entity: ExampleEntity }

export const examplePolicy: Policy<ExampleAction> = (user, action) => {
  if (isAdmin(user)) return ok(undefined)

  switch (action.type) {
    case 'create':
      return ok(undefined)
    case 'read':
    case 'update':
    case 'delete':
      return action.entity.userId === user.id
        ? ok(undefined)
        : err(new ForbiddenError(`cannot ${action.type} on ${action.entity.id}`))
  }
}

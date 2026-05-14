import type { ExampleEntityId, UserId } from '@/shared/lib/ids'

import type { ExampleEntity } from '../domain/example-entity'

export type NewExampleEntity = {
  userId: UserId
  title: string
  description?: string | null
}

export type UpdateExampleEntity = {
  title?: string
  description?: string | null
}

export type ExampleEntityRepository = {
  findById(id: ExampleEntityId): Promise<ExampleEntity | null>
  create(input: NewExampleEntity): Promise<ExampleEntity>
  update(id: ExampleEntityId, input: UpdateExampleEntity): Promise<ExampleEntity>
  delete(id: ExampleEntityId): Promise<void>
}

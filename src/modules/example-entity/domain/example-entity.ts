import type { ExampleEntityId, UserId } from '@/shared/lib/ids'

export type ExampleEntity = {
  id: ExampleEntityId
  userId: UserId
  title: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

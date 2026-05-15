import type { UserId } from '@/shared/lib/ids'

import type { User } from '../domain/user'

export type CreateUserInput = {
  id: UserId
  email: string
  name: string
}

export type UserRepository = {
  findById(id: UserId): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  create(input: CreateUserInput): Promise<User>
}

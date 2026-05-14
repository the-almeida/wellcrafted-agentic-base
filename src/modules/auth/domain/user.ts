import type { UserId } from '@/shared/lib/ids'

export type Role = 'user' | 'admin'

export type User = {
  id: UserId
  email: string
  name: string | null
  role: Role
  createdAt: Date
  updatedAt: Date
}

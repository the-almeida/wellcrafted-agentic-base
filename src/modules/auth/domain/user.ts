import type { UserId } from '@/shared/lib/ids'

export type Role = 'user' | 'admin'

export type User = {
  id: UserId
  email: string
  name: string
  role: Role
  /** Set while the account has an active deletion request (grace period). */
  pendingDeletion: { scheduledFor: Date } | null
  createdAt: Date
  updatedAt: Date
}

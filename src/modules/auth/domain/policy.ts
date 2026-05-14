import type { ForbiddenError } from '@/shared/lib/errors/base'
import type { Result } from '@/shared/lib/result'

import type { User } from './user'

export type Policy<TAction> = (user: User, action: TAction) => Result<void, ForbiddenError>

export function isAdmin(user: User): boolean {
  return user.role === 'admin'
}

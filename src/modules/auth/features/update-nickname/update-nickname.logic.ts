import { ConflictError, type ForbiddenError } from '@/shared/lib/errors/base'
import { err, ok, type Result } from '@/shared/lib/result'

import { userRepository } from '../../adapters/user-repository.drizzle'
import { profilePolicy } from '../../domain/policy'
import type { PublicProfile } from '../../domain/public-profile'
import type { User } from '../../domain/user'

import type { UpdateNicknameInput } from './update-nickname.schema'

/**
 * The work behind `updateNickname`, for a user the handler already
 * authenticated. Always the caller's own profile. Anonymous accounts may do
 * this (it is the one write they have).
 */
export async function updateNicknameFor(
  user: User,
  input: UpdateNicknameInput,
): Promise<Result<PublicProfile, ForbiddenError | ConflictError>> {
  const authz = profilePolicy(user, { type: 'update-nickname' })
  if (!authz.ok) return authz

  const profile = await userRepository.setNickname(user.id, input.nickname)
  if (profile === 'taken') {
    return err(new ConflictError('That nickname is too popular right now. Try another one.'))
  }
  return ok(profile)
}

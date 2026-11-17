'use server'

import { ValidationError } from '@/shared/lib/errors/base'
import { withErrorBoundary } from '@/shared/lib/errors/with-error-boundary'
import { rateLimit } from '@/shared/lib/rate-limit'
import { err } from '@/shared/lib/result'

import { requireUser } from '../../require-user'

import { updateNicknameFor } from './update-nickname.logic'
import { updateNicknameSchema } from './update-nickname.schema'

export const updateNickname = withErrorBoundary(async (raw: unknown) => {
  const userResult = await requireUser({ allow: ['anonymous'] })
  if (!userResult.ok) return userResult

  const parsed = updateNicknameSchema.safeParse(raw)
  if (!parsed.success) return err(new ValidationError(parsed.error.flatten()))

  // Each change draws a new number: bound how fast someone can cycle
  // through handles (and the scan free_discriminator does).
  const limit = await rateLimit(`profile:nickname:${userResult.value.id}`, {
    windowMs: 60 * 60 * 1000,
    max: 10,
  })
  if (!limit.ok) return limit

  return updateNicknameFor(userResult.value, parsed.data)
})

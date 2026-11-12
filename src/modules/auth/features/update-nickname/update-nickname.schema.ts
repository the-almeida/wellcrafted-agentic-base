import { z } from 'zod'

import { NicknameSchema } from '../../domain/nickname'

export const updateNicknameSchema = z.object({ nickname: NicknameSchema })

export type UpdateNicknameInput = z.infer<typeof updateNicknameSchema>

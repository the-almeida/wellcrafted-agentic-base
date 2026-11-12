import { z } from 'zod'

import { EmailSchema } from '../../domain/email'

// Same password rule as sign-up.
export const keepAccountSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8).max(72),
})

export type KeepAccountInput = z.infer<typeof keepAccountSchema>

import { z } from 'zod'

import { EmailSchema } from '../../domain/email'

export const signInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8).max(72),
})

export type SignInInput = z.infer<typeof signInSchema>

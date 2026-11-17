import { z } from 'zod'

import { EmailSchema } from '../../domain/email'

export const verifyOtpSchema = z.object({
  email: EmailSchema,
  token: z.string().regex(/^\d{6}$/, 'token must be a 6-digit code'),
})

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>

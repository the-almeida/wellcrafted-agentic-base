import { z } from 'zod'

import { EmailSchema } from '../../domain/email'

export const requestSignInOtpSchema = z.object({
  email: EmailSchema,
})

export type RequestSignInOtpInput = z.infer<typeof requestSignInOtpSchema>

import { z } from 'zod'

export const requestSignInOtpSchema = z.object({
  email: z.email(),
})

export type RequestSignInOtpInput = z.infer<typeof requestSignInOtpSchema>

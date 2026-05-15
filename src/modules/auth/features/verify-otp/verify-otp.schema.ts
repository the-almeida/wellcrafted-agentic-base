import { z } from 'zod'

export const verifyOtpSchema = z.object({
  email: z.email(),
  token: z.string().regex(/^\d{6}$/, 'token must be a 6-digit code'),
})

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>

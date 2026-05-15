import { z } from 'zod'

export const requestSignUpOtpSchema = z.object({
  email: z.email(),
  name: z
    .string()
    .min(1)
    .max(120)
    .refine((s) => s.trim().length > 0, 'name must not be blank'),
})

export type RequestSignUpOtpInput = z.infer<typeof requestSignUpOtpSchema>

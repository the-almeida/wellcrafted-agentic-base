import { z } from 'zod'

export const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
  name: z
    .string()
    .min(1)
    .max(120)
    .refine((s) => s.trim().length > 0, 'name must not be blank'),
})

export type SignUpInput = z.infer<typeof signUpSchema>

import { z } from 'zod'

export const oauthCallbackInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(128)
    .refine((s) => s.trim().length > 0, 'code must not be blank'),
  next: z
    .string()
    .default('/dashboard')
    .refine(
      (s) => s.startsWith('/') && !s.startsWith('//') && !s.includes('\\'),
      'next must be a same-origin path starting with /',
    ),
})

export type OauthCallbackInput = z.infer<typeof oauthCallbackInputSchema>

import { z } from 'zod'

// Same password rule as sign-up.
export const setPasswordSchema = z.object({ password: z.string().min(8).max(72) })

export type SetPasswordInput = z.infer<typeof setPasswordSchema>

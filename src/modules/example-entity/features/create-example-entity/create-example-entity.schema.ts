import { z } from 'zod'

export const createExampleEntitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
})

export type CreateExampleEntityInput = z.infer<typeof createExampleEntitySchema>

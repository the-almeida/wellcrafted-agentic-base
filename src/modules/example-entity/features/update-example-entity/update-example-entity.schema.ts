import { z } from 'zod'

import { ExampleEntityIdSchema } from '@/shared/lib/ids'

export const updateExampleEntitySchema = z.object({
  id: ExampleEntityIdSchema,
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
})

export type UpdateExampleEntityInput = z.infer<typeof updateExampleEntitySchema>

import { z } from 'zod'

import { ExampleEntityIdSchema } from '@/shared/lib/ids'

export const deleteExampleEntitySchema = z.object({
  id: ExampleEntityIdSchema,
})

export type DeleteExampleEntityInput = z.infer<typeof deleteExampleEntitySchema>

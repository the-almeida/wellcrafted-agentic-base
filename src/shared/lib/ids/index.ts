import { z } from 'zod'

export const UserIdSchema = z.uuid().brand<'UserId'>()
export const ExampleEntityIdSchema = z.uuid().brand<'ExampleEntityId'>()

export type UserId = z.infer<typeof UserIdSchema>
export type ExampleEntityId = z.infer<typeof ExampleEntityIdSchema>

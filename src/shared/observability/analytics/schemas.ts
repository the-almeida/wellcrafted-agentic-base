import { z } from 'zod'

import { Events } from './events'

export const eventSchemas = {
  [Events.USER_SIGNED_UP]: z.object({
    method: z.enum(['email', 'otp', 'google', 'facebook']),
  }),
  [Events.USER_SIGNED_IN]: z.object({
    method: z.enum(['email', 'otp', 'google', 'facebook']),
  }),
  [Events.USER_SIGNED_OUT]: z.object({}),
  [Events.CRITICAL_ERROR_SHOWN]: z.object({
    page: z.string(),
    code: z.string(),
  }),
  [Events.EXPECTED_ERROR]: z.object({
    kind: z.enum([
      'validation',
      'not_found',
      'forbidden',
      'unauthenticated',
      'conflict',
      'external_service',
    ]),
    feature: z.string(),
  }),
} as const

export type EventPayload<E extends keyof typeof eventSchemas> = z.infer<(typeof eventSchemas)[E]>

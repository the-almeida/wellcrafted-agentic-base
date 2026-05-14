import { PostHog } from 'posthog-node'
import type { z } from 'zod'

import { env } from '@/shared/lib/env'

import { logger } from '../logger'
import { getRequestContext } from '../request-context'

import type { EventName } from './events'
import { eventSchemas } from './schemas'

type EventPayload<E extends EventName> = E extends keyof typeof eventSchemas
  ? z.infer<(typeof eventSchemas)[E]>
  : never

let client: PostHog | null = null
function getPostHog(): PostHog | null {
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return null
  if (!client) {
    client = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return client
}

export function track<E extends EventName>(event: E, payload: EventPayload<E>): void {
  const schema = eventSchemas[event as keyof typeof eventSchemas]
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    logger.warn({ event, errors: parsed.error.flatten() }, 'analytics: invalid event payload')
    return
  }
  const ph = getPostHog()
  if (!ph) return
  const ctx = getRequestContext()
  ph.capture({
    distinctId: ctx?.userId ?? 'anonymous',
    event,
    properties: parsed.data as Record<string, unknown>,
  })
}

'use client'

import posthog from 'posthog-js'
import type { z } from 'zod'

import { env } from '@/shared/lib/env'

import type { EventName } from './events'
import { eventSchemas } from './schemas'

type EventPayload<E extends EventName> = E extends keyof typeof eventSchemas
  ? z.infer<(typeof eventSchemas)[E]>
  : never

let initialized = false

function ensureInit(): void {
  if (initialized || typeof window === 'undefined') return
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
  })
  initialized = true
}

export function identify(userId: string): void {
  ensureInit()
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.identify(userId)
}

export function reset(): void {
  if (!initialized) return
  posthog.reset()
}

export function track<E extends EventName>(event: E, payload: EventPayload<E>): void {
  ensureInit()
  const schema = eventSchemas[event as keyof typeof eventSchemas]
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    console.warn('analytics: invalid event payload', event, parsed.error.flatten())
    return
  }
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.capture(event, parsed.data as Record<string, unknown>)
}

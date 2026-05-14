import pino from 'pino'

import { env } from '@/shared/lib/env'

import { getRequestContext } from './request-context'

const REDACT_PATHS = [
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  '*.email',
  '*.phone',
]

const transport =
  process.env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
      }
    : {}

export const logger = pino({
  level: env.LOG_LEVEL ?? 'info',
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  mixin() {
    const ctx = getRequestContext()
    if (!ctx) return {}
    return {
      requestId: ctx.requestId,
      ...(ctx.userId ? { userId: ctx.userId } : {}),
    }
  },
  ...transport,
})

export type Logger = typeof logger

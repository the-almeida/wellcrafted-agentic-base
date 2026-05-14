import { AsyncLocalStorage } from 'node:async_hooks'

import type { UserId } from '@/shared/lib/ids'

export type RequestContext = {
  requestId: string
  userId?: UserId
}

const storage = new AsyncLocalStorage<RequestContext>()

export function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn)
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore()
}

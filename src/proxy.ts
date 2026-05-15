import { randomUUID } from 'node:crypto'

import { type NextRequest } from 'next/server'

import { updateSession } from '@/modules/auth'

// Next 16 `proxy.ts` (formerly `middleware.ts`) always runs on the Node
// runtime — no explicit `runtime` export needed. The project-wide Edge
// ban (scripts/check-no-edge.sh) covers individual routes.

export async function proxy(request: NextRequest) {
  // Inject the request pathname into the request headers BEFORE
  // updateSession constructs the NextResponse. Server Components read it
  // via `headers().get('x-pathname')`; Next.js does not otherwise pass
  // the pathname to layouts/pages.
  request.headers.set('x-pathname', request.nextUrl.pathname)

  const response = await updateSession(request)

  const requestId = request.headers.get('x-request-id') ?? randomUUID()
  response.headers.set('x-request-id', requestId)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

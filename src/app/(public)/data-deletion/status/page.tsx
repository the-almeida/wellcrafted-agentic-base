import type { Metadata } from 'next'

import { getRequestIp } from '@/shared/lib/http/request-ip'
import { rateLimit } from '@/shared/lib/rate-limit'

import { findDeletionRequestByCode } from '@/modules/auth'

// noindex: per-user URLs handed out by Facebook should not be indexed.
export const metadata: Metadata = {
  title: 'Data Deletion Status',
  description: 'Check the status of an account deletion request.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeZone: 'UTC',
})

function GenericNotFoundMessage() {
  return (
    <p>
      Your data deletion request has been processed or could not be found. If you believe this is
      wrong, please contact us at <a href="mailto:{{DPO_EMAIL}}">{'{{DPO_EMAIL}}'}</a>.
    </p>
  )
}

export default async function DataDeletionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>
}) {
  const params = await searchParams
  const rawCode = params.code
  const code = typeof rawCode === 'string' ? rawCode : ''

  // Per-IP rate limit. Confirmation codes are 128-bit secrets so brute
  // force isn't a realistic threat, but the limiter caps DB query
  // volume from a misbehaving client. Rate-limited callers render
  // identically to misses — preserves the "no info leak" posture.
  const ip = await getRequestIp()
  const limit = await rateLimit(`data-deletion-status:ip:${ip}`, {
    windowMs: 60_000,
    max: 60,
  })
  const request = limit.ok && code ? await findDeletionRequestByCode(code) : null

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Data Deletion Status</h1>
      </header>
      <div className="text-sm leading-relaxed [&_a]:underline">
        {!request ? (
          <GenericNotFoundMessage />
        ) : request.cancelledAt ? (
          <p>
            This deletion request was <strong>cancelled</strong> on{' '}
            <strong>{dateFormatter.format(request.cancelledAt)} UTC</strong>. Your account remains
            active. No further action is required.
          </p>
        ) : request.completedAt ? (
          <p>
            This deletion request has been <strong>completed</strong>. The associated account and
            its personal data have been removed.
          </p>
        ) : (
          <p>
            This deletion request is <strong>pending</strong>. The account is scheduled for
            permanent deletion on <strong>{dateFormatter.format(request.scheduledFor)} UTC</strong>.
            The account owner can cancel the deletion until that date by signing in.
          </p>
        )}
      </div>
    </article>
  )
}

import { randomBytes } from 'node:crypto'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import { accountDeletionRequests } from '@/shared/db/schema'
import type { AccountDeletionRequestRow } from '@/shared/db/schema/account-deletion'
import {
  AccountDeletionRequestIdSchema,
  type AccountDeletionRequestId,
  type UserId,
} from '@/shared/lib/ids'

/**
 * Integration-test helper. Never import from production code.
 *
 * The probe gives up well before RACE_TEST_TIMEOUT_MS, so a race that never
 * reproduces fails with its own message instead of a generic timeout.
 */
const RACE_DEADLINE_MS = 2_000
export const RACE_TEST_TIMEOUT_MS = 15_000

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown }

/**
 * Makes `run` lose a race for the user's active deletion request,
 * deterministically, instead of hoping two parallel calls interleave.
 *
 * A transaction inserts the competing active request and stays open, so
 * `run`'s precheck cannot see it and its INSERT blocks on the partial unique
 * index. Once Postgres reports `run` as blocked by that transaction, we
 * commit, and the blocked INSERT fails with 23505: exactly what a real
 * concurrent opener produces.
 *
 * `track` receives the id of every row the user ends up with (the winner,
 * plus any extra row a regression lets the loser insert), so the caller's
 * cleanup removes them. `rows` is that final set.
 */
export async function loseDeletionRequestRace<T>(args: {
  userId: UserId
  winnerSource: AccountDeletionRequestRow['source']
  track: (id: AccountDeletionRequestId) => void
  run: () => Promise<T>
}): Promise<{ outcome: T; winnerCode: string; rows: AccountDeletionRequestRow[] }> {
  const winnerCode = randomBytes(16).toString('base64url')
  let release!: () => void
  const released = new Promise<void>((resolve) => (release = resolve))
  let holding!: (pid: number) => void
  const held = new Promise<number>((resolve) => (holding = resolve))

  let winnerId: AccountDeletionRequestId | undefined
  const winner = db.transaction(async (tx) => {
    const [row] = await tx
      .insert(accountDeletionRequests)
      .values({
        userId: args.userId,
        scheduledFor: new Date(Date.now() + 86_400_000),
        source: args.winnerSource,
        confirmationCode: winnerCode,
      })
      .returning()
    winnerId = AccountDeletionRequestIdSchema.parse(row!.id)
    args.track(winnerId)
    const [backend] = await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`)
    holding(backend!.pid)
    await released
  })

  // If the winner fails before holding, surface its error instead of
  // waiting forever on `held`.
  const winnerPid = await Promise.race([
    held,
    winner.then(() => {
      throw new Error('the winner transaction finished without holding its row')
    }),
  ])

  let loser: Promise<Settled<T>> | undefined
  try {
    loser = args.run().then(
      (value): Settled<T> => ({ ok: true, value }),
      (error: unknown): Settled<T> => ({ ok: false, error }),
    )
    const deadline = Date.now() + RACE_DEADLINE_MS
    for (;;) {
      const [probe] = await db.execute<{ blocked: number }>(
        sql`SELECT count(*)::int AS blocked FROM pg_stat_activity
            WHERE ${winnerPid}::int = ANY(pg_blocking_pids(pid))`,
      )
      if (probe!.blocked > 0) break
      if (Date.now() > deadline) {
        throw new Error('the loser never blocked on the winner; the race was not reproduced')
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  } finally {
    // Every exit path commits the winner, so no lock outlives the test and
    // the caller's cleanup can delete the user.
    release()
    await winner
  }

  const rows = await db
    .select()
    .from(accountDeletionRequests)
    .where(eq(accountDeletionRequests.userId, args.userId))
  for (const row of rows) {
    if (row.id !== winnerId) args.track(AccountDeletionRequestIdSchema.parse(row.id))
  }

  const settled = await loser
  if (!settled.ok) throw settled.error
  return { outcome: settled.value, winnerCode, rows }
}

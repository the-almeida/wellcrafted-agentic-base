import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db/client'
import { accountDeletionRequests, activeDeletionRequest } from '@/shared/db/schema/account-deletion'
import { users } from '@/shared/db/schema/auth'
import type { UserId } from '@/shared/lib/ids'

import type { PublicProfile } from '../domain/public-profile'
import type { User } from '../domain/user'

// The constraints a nickname change trips when no number is left for it
// (free_discriminator returns NULL) or when two changes draw the same one.
const HANDLE_TAKEN_CONSTRAINTS = new Set(['users_profile_complete', 'users_public_handle_idx'])

function constraintName(error: unknown): string | undefined {
  return (error as { cause?: { constraint_name?: string } }).cause?.constraint_name
}

// The database checks keep the row coherent (email unless anonymous,
// nickname and discriminator together), so this only maps it.
function rowToUser(row: typeof users.$inferSelect, pendingDeletion: User['pendingDeletion']): User {
  return {
    id: row.id,
    isAnonymous: row.isAnonymous,
    email: row.email,
    name: row.name,
    profile:
      row.nickname !== null && row.discriminator !== null
        ? { nickname: row.nickname, discriminator: row.discriminator }
        : null,
    role: row.role,
    pendingDeletion,
    emailVerifiedAt: row.emailVerifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// No port in front: one implementation, tested against the local database
// (ADR-0007). Rows are created by the auth trigger, not by the app.
export const userRepository = {
  // One query for the user and their account state. The active-request
  // condition must stay in the join (ON), not in WHERE: in WHERE, a user
  // whose requests were all cancelled would not be found at all.
  async findById(id: UserId) {
    const [row] = await db
      .select({ user: users, scheduledFor: accountDeletionRequests.scheduledFor })
      .from(users)
      .leftJoin(
        accountDeletionRequests,
        and(eq(accountDeletionRequests.userId, users.id), activeDeletionRequest()),
      )
      .where(eq(users.id, id))
      .limit(1)
    if (!row) return null
    return rowToUser(row.user, row.scheduledFor ? { scheduledFor: row.scheduledFor } : null)
  },
  /**
   * Sets the public profile's nickname. A new nickname gets a newly drawn
   * free number (public.free_discriminator); a change of letter case only
   * keeps the number, since handles compare case-insensitively. Answers
   * 'taken' when no number is free for the nickname (or a concurrent change
   * drew the same one), with the row unchanged.
   */
  async setNickname(id: UserId, nickname: string): Promise<PublicProfile | 'taken'> {
    try {
      const [row] = await db
        .update(users)
        .set({
          nickname,
          discriminator: sql`CASE WHEN lower(${users.nickname}) = lower(${nickname})
            THEN ${users.discriminator} ELSE public.free_discriminator(${nickname}) END`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({ nickname: users.nickname, discriminator: users.discriminator })
      if (!row?.nickname || row.discriminator === null) {
        throw new Error('nickname update returned no profile')
      }
      return { nickname: row.nickname, discriminator: row.discriminator }
    } catch (error) {
      const constraint = constraintName(error)
      if (constraint && HANDLE_TAKEN_CONSTRAINTS.has(constraint)) return 'taken'
      throw error
    }
  },
  /**
   * Records that the person proved control of `provenEmail` (a code sent
   * to it, or an OAuth provider vouching for it), only while it is still
   * the account's email: proving an old address must not verify a new one.
   * The first time wins: later calls keep it.
   */
  async markEmailVerified(id: UserId, provenEmail: string) {
    await db
      .update(users)
      .set({ emailVerifiedAt: sql`COALESCE(${users.emailVerifiedAt}, now())` })
      .where(and(eq(users.id, id), sql`lower(${users.email}) = lower(${provenEmail})`))
  },
  /**
   * What the first proof of the account's email calls for, when proving
   * `provenEmail` now is that first proof (the account's email, not yet
   * verified). Any password on such an account may have been set by
   * someone who never owned the email (Confirm email is off), so it must be
   * replaced: `secure`. Asking the person for a new one only makes sense
   * when the account existed before this sign-in: `askForPassword`. A code
   * or OAuth sign-up creates the account in the same flow that proves it.
   */
  async firstEmailProof(
    id: UserId,
    provenEmail: string,
  ): Promise<{ secure: boolean; askForPassword: boolean }> {
    const rows = await db.execute<{ secure: boolean; old: boolean }>(sql`
      SELECT (email_verified_at IS NULL AND lower(email) = lower(${provenEmail})) AS secure,
             created_at < now() - interval '5 minutes' AS old
      FROM public.users WHERE id = ${id}
    `)
    const secure = rows[0]?.secure === true
    return { secure, askForPassword: secure && rows[0]?.old === true }
  },
}

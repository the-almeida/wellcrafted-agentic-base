import type { UserId } from '@/shared/lib/ids'

import type { PublicProfile } from './public-profile'

export type Role = 'user' | 'admin'

/**
 * One shape for every account. An anonymous account (Supabase's anonymous
 * sign-in) is the same User with `isAnonymous: true`: no email, no name,
 * and its nickname as the public profile. Converting it to a permanent
 * account keeps the id and the profile.
 */
export type User = {
  id: UserId
  isAnonymous: boolean
  /** Null only for anonymous accounts. */
  email: string | null
  /** Null for anonymous accounts and accounts converted from one. */
  name: string | null
  /** How the account is shown to others ("Wolf #0042"); always set for anonymous accounts. */
  profile: PublicProfile | null
  role: Role
  /** Set while the account has an active deletion request (grace period). */
  pendingDeletion: { scheduledFor: Date } | null
  /** When the person proved control of the email; null when not known (always for anonymous). */
  emailVerifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

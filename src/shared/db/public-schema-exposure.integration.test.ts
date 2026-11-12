import { sql, TransactionRollbackError } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { createAnonSupabase } from '@/shared/db/test-helpers'

// What the public API (PostgREST, reachable with the public anon key) can
// touch in the public schema. The app itself uses the service role; these
// guard against the schema being exposed by Supabase's default grants.

describe('public schema exposure', () => {
  it('has RLS on every table', async () => {
    const rows = await db.execute<{ relname: string }>(sql`
      SELECT c.relname FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND NOT c.relrowsecurity
    `)

    expect(rows.map((row) => row.relname)).toEqual([])
  })

  it('does not let the anon key run the account purge', async () => {
    const { error } = await createAnonSupabase().rpc('purge_expired_account_deletions')

    expect(error).not.toBeNull()
  })

  it('gives a new table no privileges for anon or authenticated by default', async () => {
    // The probe table lives only inside a transaction that is rolled back.
    let privileges: { anon: boolean; authenticated: boolean } | undefined
    await db
      .transaction(async (tx) => {
        await tx.execute(sql`CREATE TABLE public.zz_default_grants_probe (id int)`)
        const [row] = await tx.execute<{ anon: boolean; authenticated: boolean }>(sql`
          SELECT
            has_table_privilege('anon', 'public.zz_default_grants_probe', 'SELECT, INSERT, UPDATE, DELETE') AS anon,
            has_table_privilege('authenticated', 'public.zz_default_grants_probe', 'SELECT, INSERT, UPDATE, DELETE') AS authenticated
        `)
        privileges = row
        tx.rollback()
      })
      // tx.rollback() rejects with Drizzle's TransactionRollbackError, by design.
      .catch((error: unknown) => {
        if (!(error instanceof TransactionRollbackError)) throw error
      })

    expect(privileges).toEqual({ anon: false, authenticated: false })
  })
})

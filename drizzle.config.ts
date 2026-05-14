import type { Config } from 'drizzle-kit'

export default {
  schema: './src/shared/db/schema/index.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  // Emits `<14-digit-timestamp>_<name>.sql` so Supabase CLI picks them up
  // alongside hand-authored RLS / trigger migrations and applies the whole
  // sequence in timestamp order. See ADR-0003.
  migrations: { prefix: 'supabase' },
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config

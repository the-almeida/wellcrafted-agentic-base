#!/usr/bin/env bash
set -euo pipefail

echo "→ Checking system dependencies..."

command -v pnpm >/dev/null || { echo "✗ pnpm not found. Install: https://pnpm.io"; exit 1; }
command -v supabase >/dev/null || { echo "✗ supabase CLI not found. Install: https://supabase.com/docs/guides/cli"; exit 1; }
command -v jq >/dev/null || { echo "✗ jq not found. Install: 'apt install jq' or 'brew install jq'"; exit 1; }

required_node=22
current_node=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$current_node" -ge "$required_node" ] || { echo "✗ Need Node $required_node+, got $current_node"; exit 1; }

echo "✓ System dependencies OK"

echo "→ Installing dependencies..."
pnpm install

echo "→ Starting Supabase..."
supabase start

echo "→ Populating .env.local from Supabase status..."
if [ ! -f .env.local ]; then
  cp .env.example .env.local

  ANON_KEY=$(supabase status -o json | jq -r '.ANON_KEY')
  SERVICE_KEY=$(supabase status -o json | jq -r '.SERVICE_ROLE_KEY')
  API_URL=$(supabase status -o json | jq -r '.API_URL')
  DB_URL=$(supabase status -o json | jq -r '.DB_URL')

  sed -i.bak "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$API_URL|" .env.local
  sed -i.bak "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY|" .env.local
  sed -i.bak "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY|" .env.local
  sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env.local
  rm -f .env.local.bak
fi

# Migrations applied by `supabase start` above. Drizzle-generated SQL
# files live alongside hand-authored ones in `supabase/migrations/` and
# run as a single ordered sequence. See ADR-0003.

echo ""
echo "✓ Bootstrap complete. Run: pnpm dev"

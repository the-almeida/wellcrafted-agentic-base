#!/usr/bin/env bash
set -euo pipefail

if ! pnpm exec supabase status >/dev/null 2>&1; then
  echo "→ Starting Supabase..."
  pnpm exec supabase start
fi

# Redis + serverless-redis-http for the rate-limit tests (idempotent).
docker compose up -d --wait

pnpm exec next dev

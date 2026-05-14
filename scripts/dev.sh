#!/usr/bin/env bash
set -euo pipefail

if ! supabase status >/dev/null 2>&1; then
  echo "→ Starting Supabase..."
  supabase start
fi

next dev

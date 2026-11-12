#!/bin/bash
# SessionStart hook for Claude Code cloud sessions only.
# - Installs JS deps when the lockfile changed (the environment setup
#   script already installs them on a fresh container; this covers
#   lockfile changes mid-session).
# - Starts the Docker daemon, which the local Supabase stack needs.
#   Cloud containers do not run dockerd by default.
# - Boots Supabase + next dev in the background via scripts/cloud-dev-up.sh,
#   so the session is ready right away and localhost:3000 follows.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

corepack enable >/dev/null 2>&1 || true

hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  pnpm install --frozen-lockfile
  sha256sum .claude/hooks/session-start.sh package.json pnpm-lock.yaml > "$hashes" || rm -f "$hashes"
fi

if command -v dockerd >/dev/null && ! docker info >/dev/null 2>&1; then
  # Skip the start if a daemon is already booting or shutting down
  if ! pgrep -x dockerd >/dev/null; then
    setsid -f dockerd >/tmp/dockerd.log 2>&1 < /dev/null
  fi
fi

# Boot Supabase + next dev detached so the session is not blocked.
# cloud-dev-up.sh waits for dockerd itself.
WC_DEV_DIR=/tmp/wc-dev
mkdir -p "$WC_DEV_DIR"
WC_DEV_DIR="$WC_DEV_DIR" setsid -f scripts/cloud-dev-up.sh >> "$WC_DEV_DIR/dev-up.log" 2>&1 < /dev/null

# Stdout of a SessionStart hook is added to the session context.
cat <<EOF
Local dev stack is booting in the background (Supabase + next dev on port 3000).
Do not start it again. Status: cat $WC_DEV_DIR/status (starting | ready | failed).
Log: $WC_DEV_DIR/dev-up.log. Once ready, report port 3000 as the preview port.
EOF

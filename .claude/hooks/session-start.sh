#!/bin/bash
# SessionStart hook for Claude Code cloud sessions only.
# - Installs JS deps when the lockfile changed (the environment setup
#   script already installs them on a fresh container; this covers
#   lockfile changes mid-session).
# - Starts the Docker daemon, which the local Supabase stack needs.
#   Cloud containers do not run dockerd by default.
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
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  docker info >/dev/null 2>&1 || echo "dockerd did not start; see /tmp/dockerd.log" >&2
fi

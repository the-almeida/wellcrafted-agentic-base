#!/usr/bin/env bash
# Brings up the local stack (Docker -> Supabase -> next dev) in a Claude
# Code cloud session. Launched detached by .claude/hooks/session-start.sh so
# the session starts immediately while the stack boots in parallel.
#
# State is written to $WC_DEV_DIR/status: starting | ready | failed.
# Full output goes to $WC_DEV_DIR/dev-up.log.
set -euo pipefail

WC_DEV_DIR="${WC_DEV_DIR:-/tmp/wc-dev}"
PORT=3000
mkdir -p "$WC_DEV_DIR"

status() { echo "$1" > "$WC_DEV_DIR/status"; echo "[cloud-dev-up] $1"; }
fail() { status failed; echo "[cloud-dev-up] $1" >&2; exit 1; }

# One instance at a time (SessionStart also fires on resume).
exec 9> "$WC_DEV_DIR/lock"
flock -n 9 || { echo "[cloud-dev-up] already running"; exit 0; }

cd "$(dirname "$0")/.."

if curl -sf -o /dev/null --max-time 5 "http://localhost:$PORT/"; then
  status ready
  exit 0
fi

status starting

for _ in $(seq 1 60); do
  docker info >/dev/null 2>&1 && break
  sleep 1
done
docker info >/dev/null 2>&1 || fail "docker not available; see /tmp/dockerd.log"

if [ ! -f .env.local ]; then
  pnpm bootstrap || fail "bootstrap failed"
elif ! pnpm exec supabase status >/dev/null 2>&1; then
  pnpm exec supabase start || fail "supabase start failed"
fi

pnpm exec next dev --port "$PORT" &
next_pid=$!

for _ in $(seq 1 180); do
  kill -0 "$next_pid" 2>/dev/null || fail "next dev exited"
  if curl -sf -o /dev/null --max-time 60 "http://localhost:$PORT/"; then
    status ready
    break
  fi
  sleep 1
done

[ "$(cat "$WC_DEV_DIR/status")" = ready ] || fail "next dev did not respond on :$PORT"

wait "$next_pid"

#!/usr/bin/env bash
set -euo pipefail

# Edge runtime is banned project-wide. Pino, AsyncLocalStorage continuity,
# and node:crypto are Node-only. See docs/architecture.md → Runtime model.

if grep -rE "runtime\s*=\s*['\"]edge['\"]" src/ 2>/dev/null; then
  echo "✗ Edge runtime is forbidden. See docs/architecture.md → Runtime model."
  exit 1
fi
exit 0

#!/usr/bin/env bash
set -euo pipefail

# Every module whose handlers call `requireUser` must export a
# `domain/policy.ts`. The auth module is the policy provider, not a
# consumer, so it's exempt.

EXIT=0
for module in src/modules/*/; do
  name=$(basename "$module")
  if [ "$name" = "auth" ]; then continue; fi

  features_dir="${module}features"
  if [ ! -d "$features_dir" ]; then continue; fi

  if grep -rqE "from ['\"]@/modules/auth['\"]" "$features_dir" 2>/dev/null \
     && grep -rqE "requireUser" "$features_dir" 2>/dev/null; then
    if [ ! -f "${module}domain/policy.ts" ]; then
      echo "✗ Module '${name}' uses requireUser but has no domain/policy.ts"
      EXIT=1
    fi
  fi
done
exit $EXIT

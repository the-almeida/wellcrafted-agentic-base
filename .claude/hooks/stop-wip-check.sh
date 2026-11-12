#!/bin/bash
# Stop hook for Claude Code cloud sessions only.
# The container is reclaimed after inactivity with no warning, so anything
# not pushed is lost. When the turn ends with uncommitted or unpushed work,
# block the stop once and ask the agent to run /wc-temp-cloud-container-handoff
# (or say why not). The second stop in a row always passes, so this never loops.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

input=$(cat)
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)
branch=${branch//[\"\\]/} # keep the JSON below valid
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

if git rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then
  unpushed=$(git rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo 0)
elif git rev-parse --verify --quiet origin/main >/dev/null; then
  unpushed=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
else
  unpushed=0
fi

if [ "$dirty" = "0" ] && [ "$unpushed" = "0" ]; then
  exit 0
fi

reason="Cloud container work at risk on branch '$branch': $dirty uncommitted path(s), $unpushed unpushed commit(s). The container can be reclaimed at any time. Run /wc-temp-cloud-container-handoff now. If the user asked not to commit yet, or the code does not typecheck, say so in one line instead and stop."
if [ "$branch" = "main" ]; then
  reason="$reason You are on main: move the work to your claude/* branch first, never push main."
fi

printf '{"decision":"block","reason":"%s"}\n' "$reason"

#!/bin/bash
# PreToolUse(Bash) hook for Claude Code cloud sessions only.
# Cloud sessions start on a random branch (claude/<adjective>-<name>-<hash>).
# Block any `git push` whose target claude/* branch does not follow
# claude/<conventional-type>-<kebab-slug>, so the agent renames it first.
# Claude picks the slug; this hook only enforces that it happened.
# Anything unexpected (bad input, no repo, detached HEAD) fails open.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

command=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$command" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
current=$(git symbolic-ref --short -q HEAD 2>/dev/null || true)

VALID='^claude/(feat|fix|chore|docs|refactor|test|perf|ci|build|style|revert)-[a-z0-9]+(-[a-z0-9]+)*$'

# Prints the branches a `git push <args...>` would update (one per line).
push_targets() {
  local delete=false skip_next=false arg
  local -a positional=()
  for arg in "$@"; do
    if $skip_next; then skip_next=false; continue; fi
    case "$arg" in
      -d | --delete) delete=true ;;
      -o | --push-option | --repo | --receive-pack | --exec) skip_next=true ;;
      -*) ;;
      *) positional+=("$arg") ;;
    esac
  done
  $delete && return 0

  if [ "${#positional[@]}" -le 1 ]; then
    [ -n "$current" ] && printf '%s\n' "$current"
    return 0
  fi

  local refspec dst
  for refspec in "${positional[@]:1}"; do
    refspec=${refspec#+}
    case "$refspec" in :*) continue ;; esac # :branch deletes it
    dst=${refspec##*:}
    [ "$dst" = "HEAD" ] && dst=$current
    printf '%s\n' "${dst#refs/heads/}"
  done
}

bad=""
segments=$(printf '%s\n' "$command" | sed -E 's/(&&|\|\||;|\|)/\n/g')
while IFS= read -r segment; do
  read -ra words <<<"$segment"
  [ "${words[0]:-}" = "git" ] || continue
  i=1
  while [ "$i" -lt "${#words[@]}" ]; do # skip git global options
    case "${words[$i]}" in
      -C | -c) i=$((i + 2)) ;;
      -*) i=$((i + 1)) ;;
      *) break ;;
    esac
  done
  [ "${words[$i]:-}" = "push" ] || continue

  while IFS= read -r target; do
    [ -n "$target" ] || continue
    if [[ "$target" == claude/* ]] && ! [[ "$target" =~ $VALID ]]; then
      bad=$target
    fi
  done < <(push_targets "${words[@]:$((i + 1))}")
done <<<"$segments"

[ -n "$bad" ] || exit 0

cat >&2 <<EOF
Push blocked: branch '$bad' does not follow claude/<type>-<slug>.
<type> is a conventional-commit type (feat, fix, chore, docs, refactor, test, perf, ci, build, style, revert); <slug> is lowercase kebab-case describing the work, e.g. claude/feat-audit-log.
Rename, push the new branch, then delete the old remote branch if it exists:
  git branch -m claude/<type>-<slug>
  git push -u origin claude/<type>-<slug>
  git push origin --delete $bad
If a draft PR is open on the old branch, open a new one from the renamed branch and close the old one.
EOF
exit 2

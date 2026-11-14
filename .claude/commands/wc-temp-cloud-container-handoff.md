---
description: Cloud sessions only. Commit and push WIP, keep a draft PR open, and rewrite its handoff block so the next session can resume.
---

# Cloud container handoff

The cloud container is reclaimed after inactivity with no warning. The branch, the draft PR and the PR's handoff block are the only state that survives. Run this after each green TDD slice, at the end of every turn that changed files, and whenever the `Stop` hook asks for it.

## Steps

1. **Guard.** If `CLAUDE_CODE_REMOTE` is not `true`, say this command is for cloud sessions only and stop
2. **Branch.** Work only on the session's `claude/*` branch. Never commit to or push `main`. If changes sit on `main`, move them to the branch first. If the branch still has the session's random name (anything not matching `claude/<type>-<slug>`, e.g. `claude/nifty-cray-c5i9qp`), rename it before pushing: `git branch -m claude/<type>-<slug>` with a conventional-commit type and a short kebab-case slug for the work (`claude/feat-audit-log`), then after step 5 try to delete the old remote branch if it exists (`git push origin --delete <old>`). Cloud git access may refuse deletes with a 403; if so, leave the old branch and move on. The user's instruction here is the permission to push to the renamed branch. The `pre-push-branch-name.sh` hook blocks pushes that skip this
3. **Commit.** Stage the changes that belong to the work (never `.env*`, secrets, or scratch files) and commit with a conventional message as in `docs/conventions.md#conventional-commits`. There is no `wip` type: use the type the change really is (`test(auth): ...` for a slice in progress is fine). Small commits are fine; squash them at merge if the history is noisy
4. **Hooks.** `pre-commit` (lint-staged, typecheck, policy checks) and `commit-msg` run. If they fail, fix the cause. If it cannot be fixed this turn, leave the change uncommitted and say so in the handoff and to the user. Never `--no-verify`
5. **Push.** `git push -u origin <branch>`. On network errors retry up to 4 times (2s, 4s, 8s, 16s). The `pre-push` hook skips tests for `claude/*` pushes from cloud sessions; CI runs them on the PR
6. **Draft PR.** Look up the open PR for the branch. If there is none, create one as a **draft** against `main`, with the handoff block in its body. Never mark it ready for review or merge it unless the user asks
7. **Handoff block.** Rewrite only the text between the markers in the PR body, leaving everything else untouched. Read the current body first and merge, do not drop information that is still true:

   ```markdown
   <!-- handoff:start -->

   ## Handoff

   **Updated:** <YYYY-MM-DD HH:MM UTC> at `<short sha>`

   **Status:** <what works now, which behaviors from the approved list are done / in progress>

   **Next step:** <the single next action, specific enough to start without re-reading the conversation>

   **Decisions:** <decisions made with the user that are not yet in code, CONTEXT.md or an ADR>

   **Blockers / open questions:** <or "none">

   **Evidence:** <links to Artifact pages with screenshots / QA reports, or "none">

   <!-- handoff:end -->
   ```

8. **Evidence.** Screenshots and QA reports go to a private Artifact page, never into the repo. Link it under **Evidence**
9. **Report** the PR link and the pushed sha to the user in one line

## Resuming

At the start of a cloud session on an existing branch, read the open PR's handoff block before doing anything else, and continue from **Next step**.

## Rules

- The handoff block is temporary working state. Durable knowledge goes to code, `CONTEXT.md`, an ADR or `docs/` as usual
- No secrets, tokens, internal hostnames or PII in the handoff block: PR bodies are visible to everyone with repo access
- The handoff block stays in the PR body for the PR's whole life, draft or not. When the PR leaves draft, write the normal description above the block and keep updating the block while work continues

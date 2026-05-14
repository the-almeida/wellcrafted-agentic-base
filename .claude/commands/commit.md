---
description: Run review, generate conventional commit, ask for confirmation before committing.
---

# Commit

## Steps

1. Read the staged diff (`git diff --cached`). If nothing is staged, read the unstaged diff and ask the user whether to stage it
2. Run the `/review` checklist internally. If any item FAILs, surface it to the user and ask: "Fix first or proceed anyway?"
3. If the user chooses to proceed (or no FAILs were found), generate a conventional commit message:
   - Header: `<type>(<scope>): <short description>` (≤72 chars)
   - Body: explain WHY the change was made, not what (the diff already shows what)
   - Footer: breaking changes, issue references
4. Show the proposed message to the user. Ask for confirmation
5. On confirmation, run `git commit -m "..."` (use heredoc for multi-line bodies)
6. The `pre-commit` and `commit-msg` Husky hooks run automatically. If they fail, surface the error to the user
7. Confirm the commit hash on success

## Rules

- Type is one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `build`, `ci`
- Scope is the module name when meaningful (`feat(auth): ...`)
- Header is imperative, present tense ("add" not "added")
- Body explains why, not what
- No `--no-verify`. Ever
- If hooks fail, the commit does not happen. Fix the cause and re-run `/commit`

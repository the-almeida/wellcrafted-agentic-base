---
description: Test-driven development with vertical red-green-refactor. Builds features one behavior at a time.
---

# Test-Driven Development

## Philosophy

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests should not.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe what the system does, not how it does it. A good test reads like a specification.

**Bad tests** are coupled to implementation. They mock internal collaborators or verify through external means. Warning sign: the test breaks when you refactor, but behavior has not changed.

## Anti-pattern: horizontal slicing

DO NOT write all tests first, then all implementation. That produces tests of imagined behavior, not real behavior. Tests written in bulk verify shape (data structures, function signatures) rather than user-facing behavior.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4
  GREEN: impl1, impl2, impl3, impl4

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  ...
```

## Workflow

### 0. Prerequisite: alignment

Before invoking `/wc-tdd`, the user has run `/wc-grill` (or equivalent) and `CONTEXT.md` is up to date for relevant terms. If the alignment is unclear, stop and request `/wc-grill` first.

### 1. List behaviors

List the behaviors this change must satisfy. Cover:

- Happy path
- Edge cases (empty input, max input, boundary values)
- Adversarial input (malformed, unauthorized, conflicting state)
- Security concerns (input validation, authorization, data leakage)

Prioritize the list. Get the user's explicit approval before writing any test.

If the list is wrong or missing items, fix it before proceeding. Do not write tests against an unapproved list.

### 2. Tracer bullet (first behavior)

```
RED:   write one test for the first behavior, run it, observe it fail. Keep the failure output.
GREEN: write the minimum code to pass, run it, observe it pass.
AUDIT: invoke @wc-test-auditor (see "Auditor handoff" below). On `fail` verdict, halt and resolve before continuing.
```

This proves the path works end-to-end.

### 3. Incremental loop

For each remaining behavior in the approved list:

```
RED:   write next test, run it, observe it fail. Keep the failure output.
GREEN: minimum code to pass, run it, observe it pass.
AUDIT: invoke @wc-test-auditor with the test, the RED output, and the GREEN diff. On `fail`, halt and resolve.
```

Rules:

- One test at a time
- Only enough code to pass the current test
- Do not anticipate future tests
- Tests focus on observable behavior, not internals

### Auditor handoff

After each GREEN, invoke `@wc-test-auditor` with three artifacts:

1. The test file(s) added or modified in this cycle.
2. The RED output captured before GREEN — the failure message and stack from the test runner. Paste it verbatim into the agent prompt.
3. The diff of code-under-test files changed between RED and GREEN.

The agent returns a JSON report with `verdict: pass | fail` and structured findings. On `pass`, advance to the next behavior. On `fail`, halt: every `blocker` finding must be resolved before continuing. Resolve by either:

- **Editing the test** to remove the evasion (preferred), then re-running RED → GREEN → `@wc-test-auditor`; or
- **Adding an inline override** on the relevant line: `// @wc-test-auditor-allow: <heuristic-id> — <reason>`. The reason must be specific and verifiable (see `docs/conventions.md#test-quality`). A vague reason ("not applicable", "needed for the test") is itself a finding.

Do not silently ignore the verdict. Do not paraphrase the findings into a casual "looks fine" message to the user — surface the full JSON report so the user can decide.

### 4. Refactor

Once all tests are green, look for refactor candidates:

- Extract duplication that has appeared three times (rule of three)
- Deepen modules (move complexity behind simple interfaces)
- Apply SOLID where natural
- Run tests after each refactor step

NEVER refactor while red. Get to green first.

## Hard rules

- RED is real. The test must run and fail before GREEN
- Never simplify or remove a test to make implementation easier
- Never delete a test without explicit user approval
- Never mock the code being tested
- Mock only at the port boundary (external dependencies), never internal collaborators
- `@wc-test-auditor`'s `fail` verdict halts the cycle. Resolve by editing the test or by adding a specific `// @wc-test-auditor-allow: <heuristic-id> — <reason>` override
- Never mask a failure to make a test pass. If the failure is real, fix the code, not the test

## Per-cycle checklist

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive an internal refactor
[ ] Code is the minimum for this test
[ ] No speculative features added
[ ] RED output captured before GREEN
[ ] @wc-test-auditor verdict is pass (or every blocker has a justified inline override)
```

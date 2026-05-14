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

Before invoking `/tdd`, the user has run `/grill` (or equivalent) and `CONTEXT.md` is up to date for relevant terms. If the alignment is unclear, stop and request `/grill` first.

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
RED:   write one test for the first behavior, run it, observe it fail
GREEN: write the minimum code to pass, run it, observe it pass
```

This proves the path works end-to-end.

### 3. Incremental loop

For each remaining behavior in the approved list:

```
RED:   write next test, run it, observe it fail
GREEN: minimum code to pass, run it, observe it pass
```

Rules:

- One test at a time
- Only enough code to pass the current test
- Do not anticipate future tests
- Tests focus on observable behavior, not internals

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
- Never mock the system under test
- Mock only at the port boundary (external dependencies), never internal collaborators

## Per-cycle checklist

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive an internal refactor
[ ] Code is the minimum for this test
[ ] No speculative features added
```

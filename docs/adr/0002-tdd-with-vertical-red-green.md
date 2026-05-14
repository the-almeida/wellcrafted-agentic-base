# 0002. TDD with Vertical Red-Green-Refactor

Date: 2026-05-13
Status: Accepted

## Context

The boilerplate is designed for agentic coding. Coding agents tend to fail in predictable ways: writing all tests upfront against imagined behavior, or skipping tests entirely. We need a workflow that produces tests that survive refactors and reflect real behavior.

## Decision

Use TDD with **vertical slices**:

1. List all behaviors first (happy + edge + adversarial + security). User approves the list.
2. For each behavior:
   - **RED**: write one test, run it, observe it fail
   - **GREEN**: write the minimum code to pass, run it, observe it pass
3. Refactor when all tests are green. Never refactor while red.

This is encoded in the `/tdd` slash command. The `/grill` command precedes it for alignment.

## Alternatives considered

- **Horizontal slicing** (write all tests, then all code). Rejected: produces tests that verify shape, not behavior. Tests pass when behavior breaks, fail when behavior is fine.
- **No upfront test list**. Rejected: easy to skip edge cases under time pressure. The list forces consideration before code.
- **Tests written by a separate agent**. Rejected: breaks the red-green cycle. The agent writing the test must be the one observing it fail and then making it pass.

## Consequences

Positive:

- Tests describe behavior, survive refactors
- Edge cases get listed before they get forgotten
- RED is real (test runs and fails before GREEN)

Negative:

- Slower per-feature than skipping tests
- Requires discipline to never simplify a test to fit an implementation

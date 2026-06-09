---
description: Disciplined diagnosis loop for hard bugs and performance regressions.
---

# Diagnose

A loop for hard bugs and performance regressions. Do not skip steps. Do not guess.

## Loop

1. **Reproduce** — find the smallest input or sequence that reliably triggers the bug. If you cannot reproduce, the rest of the loop is wishful thinking
2. **Minimize** — strip the reproduction down to its essentials. Remove anything that does not affect the outcome
3. **Hypothesize** — state a falsifiable hypothesis about the cause. "I think X is happening because Y."
4. **Instrument** — add logging, breakpoints, assertions, or runtime checks that would prove or disprove the hypothesis. Run the minimized reproduction
5. **Read the evidence** — what does the instrumentation actually say? Does it confirm or refute the hypothesis?
6. **Fix** — only after the cause is confirmed by evidence, write the fix
7. **Regression test** — write a test that fails without the fix and passes with it. Without this, the bug returns

## Rules

- No guesses dressed up as fixes. If your "fix" was not preceded by evidence, you are guessing
- No "I removed the line and the bug went away" without understanding why
- No swallowing errors to make symptoms disappear
- The regression test is non-negotiable. The bug returns without it

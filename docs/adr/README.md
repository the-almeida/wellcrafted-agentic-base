# Architecture Decision Records

This directory holds Architecture Decision Records (ADRs). Each ADR captures a non-trivial decision: the context, the alternatives considered, the choice made, and its consequences.

## When to write an ADR

Write an ADR only when ALL three are true:

1. **Hard to reverse** — changing your mind later costs meaningfully
2. **Surprising without context** — a future reader will wonder "why this way?"
3. **A real tradeoff** — there were genuine alternatives, you picked one for specific reasons

If any of the three is missing, skip the ADR. Notes in the code or in `CONTEXT.md` are enough.

## Format

Each ADR uses the structure shown in the existing files. Number them sequentially: `0001-`, `0002-`, etc. Use kebab-case for the slug.

## Status

ADRs may be: `Proposed`, `Accepted`, `Deprecated`, `Superseded by NNNN`.

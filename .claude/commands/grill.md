---
description: Adversarial alignment session that updates CONTEXT.md and offers ADRs when warranted.
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one at a time. For each question, provide your recommended answer.

Ask one question at a time. Wait for my answer before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead of asking me.

## Domain awareness

During exploration, look for `CONTEXT.md` at the project root. The terms in it are canonical. Use them in your questions and recommendations.

When I introduce a term, check `CONTEXT.md`:

- If the term is already defined and I use it consistently, proceed
- If the term is defined but I seem to use it differently, call it out: "CONTEXT.md defines X as Y, but you seem to mean Z. Which is it?"
- If the term is new, ask me to define it precisely. Once resolved, update `CONTEXT.md` inline. Do not batch updates

## Sharpen fuzzy language

When I use vague or overloaded terms, propose a precise canonical term. "You said 'account' — do you mean the user or the workspace? Those are different things."

## Stress-test with scenarios

When relationships between concepts are discussed, invent concrete scenarios that probe the edges. Force me to be precise about boundaries.

## Cross-reference with code

When I claim something works a certain way, check the code. If the code disagrees, surface the contradiction.

## Update CONTEXT.md inline

Capture terms as they are resolved. Format:

```markdown
**term** — definition in one or two sentences. Note any synonyms or near-misses to avoid confusion.
```

Do not couple `CONTEXT.md` to implementation details. Only include terms meaningful to domain experts.

## Offer ADRs sparingly

Only offer to create an ADR when ALL three are true:

1. **Hard to reverse** — the cost of changing the decision later is meaningful
2. **Surprising without context** — a future reader will wonder "why this way?"
3. **A real tradeoff** — there were genuine alternatives and you picked one for specific reasons

If any is missing, skip the ADR.

ADR format follows the existing files in `docs/adr/`.

## Hard rule

Do NOT write production code during a `/grill` session. The output is alignment, updated `CONTEXT.md`, and possibly an ADR. Code comes after, in `/tdd`.

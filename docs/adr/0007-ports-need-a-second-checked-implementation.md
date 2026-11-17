# 0007. Ports Need a Second, Checked Implementation

Date: 2026-11-12
Status: Accepted. Amends ADR-0001 (the "ports when external dependencies exist" rule).

## Context

ADR-0001 put a port (an interface in `ports/`) in front of every external dependency. In practice that produced ports with a single implementation that nothing swapped and no test used: the example module's repository interface sat in `ports/` while its handlers imported the Drizzle adapter directly. A port like that costs a file and an indirection, and suggests a seam that is not there: no test proves that another implementation would behave the same.

The rate limiter shows what a port is worth when it is real. `RateLimiter` has two implementations used in production (Redis, and memory as the fallback), and one contract suite runs against both, so they cannot drift apart.

## Decision

- A port exists only when it has two or more real implementations, or one real implementation plus a fake that a contract suite checks against the real one. The contract suite runs against every implementation.
- Database access goes through the module's Drizzle repository directly, with no port, and is tested against the local database.
- `adapters/` holds infrastructure code whether or not a port exists. `ports/` appears only together with a second, checked implementation.
- Reference: `src/shared/lib/rate-limit/` (`limiter.ts` is the port, `memory.ts` and `redis.ts` the implementations, `contract.test-helper.ts` the suite).

## Alternatives considered

- **Keep a port for every external dependency (ADR-0001 as written).** Rejected: single-implementation ports were ceremony, and the tests mocked around them instead of using them.
- **No ports at all; mock modules in tests.** Rejected: module mocks test the code against what the author thinks the dependency does. A contract-checked fake is held to what the dependency actually does.

## Consequences

- Fewer files and no hypothetical seams in modules that only talk to the database.
- Adding a fake now costs a contract suite. That is the point: an unchecked fake is a test that passes against a dependency that does not exist.
- Swapping a provider later means introducing the port at that moment, with the contract suite as the first step.

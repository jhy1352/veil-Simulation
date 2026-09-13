# Offscreen Wake Necessity Gate

## Purpose

Establish the engine-side decision boundary for deferred off-screen world materialization.

The gate answers only:

> Is historical materialization necessary now?

It does not generate history, call an LLM, mutate CanonicalState, or commit world facts.

## Policy

Wake is permitted when the current context creates an actual historical dependency:

- `PLAYER_REENTERED_SCOPE`
- `ANCHOR_REVISITED`
- `CURRENT_STATE_REQUIRES_HISTORY`
- `NARRATIVE_DEPENDENCY`

Wake is denied for these events alone:

- `TIME_ADVANCED`
- `MAP_DISCOVERED`
- `ALREADY_MATERIALIZED`

A wake is also denied when there is no elapsed interval or no persistent anchor.

## Resulting Boundary

```text
TIME ADVANCES
    |
    v
Wake Necessity Gate
    |
    +-- no need --> 0 LLM calls
    |
    +-- need -----> Wake Aggregation
                       |
                       v
                    later LLM generation
```

This prevents map exploration and ordinary time progression from becoming direct LLM triggers.

## Files

- `src/engine/index/wakeNecessityGate.ts`
- `src/engine/index/wakeNecessityGateTest.ts`

## Verification

The test fixture covers four positive wake causes, time-only denial, map-discovery denial, repeated-materialization denial, missing-anchor denial, and zero-interval denial.

The GitHub connector does not execute the repository's Node test command in this step, so runtime test execution is not claimed here.

## Next Step

Implement Wake Aggregation: resolve related anchors into one bounded causal cluster/context so one wake can cover multiple connected world elements before any LLM call is made.

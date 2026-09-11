# Offscreen Wake Aggregation Boundary

## Scope

This report records the second engine-only step for deferred off-screen world materialization after the Wake Necessity Gate.

Target branch: `work/identity-continuity`

## Implementation

Added `aggregateOffscreenWake()` in `src/engine/index/wakeAggregation.ts`.

The function:

1. receives a seed anchor set;
2. scans only the requested `[fromTurn, toTurn]` interval;
3. follows structural co-occurrence through immutable historical action payloads;
4. expands the seed set into one deterministic causal cluster;
5. builds one `OffscreenWakeContext` for that cluster.

## Cost Boundary

The aggregation layer is deliberately LLM-free.

It prevents a direct mapping such as:

`NPC -> LLM call`
`Faction -> LLM call`
`Item -> LLM call`
`Event -> LLM call`

when those entities are already structurally connected by the same historical events.

The intended boundary is:

`seed anchor -> deterministic causal cluster -> one wake context -> later LLM generation`

This does not yet invoke Gemini and does not itself create or commit world facts.

## Safety Boundary

- Historical input remains interval-bounded.
- Unrelated entities are not included merely because they exist in CanonicalState.
- Aggregation is deterministic for identical input.
- The resulting context retains `CAUSAL_SKELETON_ONLY`.
- The resulting context retains `NON_CANONICAL_CONTEXT` authority.
- Existing Proposal / PreAuth / Sovereign Commit remains downstream of any future generated wake.

## Test Boundary

`wakeAggregationTest.ts` covers:

- seed anchor retention;
- co-occurring NPC aggregation;
- co-occurring faction aggregation;
- unrelated entity exclusion;
- single context construction for a causal cluster;
- interval-bounded history;
- preservation of generation/authority boundaries;
- deterministic repeatability.

Runtime execution is not claimed through the GitHub connector.

## Next Step

The next step is to define the actual **wake materialization request boundary**: construct the minimal causal-skeleton input for the existing LLM path only after `Wake Necessity Gate` returns YES, while preserving the existing Candidate -> Proposal -> PreAuth -> Sovereign Commit path.

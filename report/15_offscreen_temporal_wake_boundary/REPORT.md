# 15 — Off-screen Temporal Wake Boundary Forensic Report

## Audit target

Branch: `work/identity-continuity`

Goal: identify the smallest existing architecture path needed to evolve an unseen world over elapsed time without simulating every off-screen turn.

## Existing capabilities confirmed

1. **Canonical time exists.** `NarrativeTime` is part of `WorldInfo`, and `ADVANCE_TIME` is an existing transition action.
2. **Immutable History exists.** `HistoryManager` is append-only and maintains event/turn indexes. Historical records preserve `turn`, `narrativeTime`, `canonicalAction`, `informationAccess`, and causal provenance.
3. **Off-screen event storage already exists.** `RECORD_OFFSCREEN_EVENT` writes both the legacy `cameraOffscreenEvents` list and structured `offscreenRecords`.
4. **Identity structure already exists.** NPCs, factions, items, and off-screen events can be represented by stable IDs in Canonical State / the derived Knowledge Graph.
5. **Historical retrieval already exists.** Canon and Historical indexes are read-only derived structures; retrieval explicitly declares `NON_CANONICAL` authority and can mark results stale relative to Canonical State.
6. **Sovereign commit already exists.** Any future generated world change can and should continue through Proposal → PreAuth → Sovereign Commit rather than receiving a new mutation authority.

## Missing architectural boundary

The existing system records off-screen events, but it does not yet implement the inverse operation:

`last known world state + elapsed time + anchors + intervening history -> bounded causal context for deferred world materialization`

There is currently no dedicated transient boundary that tells the Narrative Layer:

- how much time has elapsed;
- which persistent entities matter;
- what historical evidence is relevant;
- that the next generation is only a causal skeleton;
- that generated material is not Canon until the existing commit path accepts it.

## Minimum causal diff implemented

Added `src/engine/index/offscreenHistoricalWake.ts`.

This module is deliberately **transient and read-only**. It introduces no new persistent world ledger and no new mutation authority. It derives a bounded `OffscreenWakeContext` from existing `CanonicalState` and immutable History.

The context explicitly declares:

- `elapsedTurns`;
- selected entity anchors;
- relevant historical records;
- `generationPolicy: CAUSAL_SKELETON_ONLY`;
- `authority: NON_CANONICAL_CONTEXT`.

Added `offscreenHistoricalWakeTest.ts` and the `test:offscreen-wake` package script to lock this boundary down.

## What this does NOT implement yet

This is intentionally not the full world simulation.

Not yet implemented:

1. automatic detection that the player has re-entered an unseen region;
2. LLM generation of a Wake/Causal Skeleton from this context;
3. conversion of that skeleton into normal Candidate/Proposal actions;
4. PreAuth + Sovereign Commit integration for the generated wake;
5. progressive resolution from skeleton → regional history → detailed scene;
6. economy/politics simulation.

Those must be subsequent layers. Adding them now would violate minimum causal diff and risk creating a second world-authority path.

## Correct next connection

The next implementation target is exactly one boundary:

`OffscreenWakeContext -> existing Narrative/LLM input -> existing Candidate pipeline -> existing Sovereign Commit`

No new `WorldSimulationSystem`, `EconomySystem`, or `PoliticsSystem` should be introduced for that step.

## Authority rule

The wake generator may propose history. It may never declare history canonical. The existing Sovereign Engine remains the only world-truth commit authority.

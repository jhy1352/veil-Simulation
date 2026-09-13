# Offscreen Wake Baseline Boundary Verification

## Scope

This report records the next minimum causal step after establishing the deferred off-screen materialization boundary.

Target branch: `work/identity-continuity`

## Finding

`buildOffscreenWakeContext()` previously selected the latest history record touching an anchor without bounding that lookup by `fromTurn`.

That allowed a historical record after the requested wake interval to become the anchor's apparent baseline. The existing `relevantHistory` filter was already bounded to `[fromTurn, toTurn]`, so the defect was specifically in the anchor baseline lookup.

## Correction

`latestHistoryForAnchor()` now accepts an optional `maxTurn` and ignores records with `record.turn > maxTurn`.

All anchor types using historical baselines (NPC, faction, inventory item, off-screen event) pass `fromTurn` as the upper boundary.

No new authority, state store, simulation subsystem, or LLM call was introduced.

## Test Boundary Added

The off-screen wake test now includes:

- a baseline NPC record at turn 250;
- a relevant NPC record at turn 301;
- an unrelated record at turn 350;
- a future NPC record at turn 450;
- wake interval `300 -> 400`.

Expected behavior:

- anchor baseline resolves to turn 250;
- turn 450 cannot contaminate the baseline;
- relevant wake history contains only turn 301 for the selected NPC;
- context construction remains non-mutating;
- reverse intervals remain rejected.

## Architectural Consequence

The wake context now has a clean temporal boundary:

`baseline <= fromTurn < wake interval <= toTurn`

This is required before connecting wake context to any future LLM generation step. Otherwise an LLM could receive a future-state baseline and construct a causally inverted history.

## Execution Status

Static source/test inspection confirms the boundary change and fixture intent. Runtime execution of `npm run test:offscreen-wake` was not performed through the GitHub connector in this step and therefore is not claimed as passed here.

## Next Step

Do not connect Gemini yet.

The next engineering step is the **Wake Necessity Gate + aggregation boundary**: determine from existing canonical/history/observation data whether a deferred wake is actually necessary, and group related anchors into one wake context. This must remain engine-only and must not trigger an LLM call merely because time advances or a map area is discovered.

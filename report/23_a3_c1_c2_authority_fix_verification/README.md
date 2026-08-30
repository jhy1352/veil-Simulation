# VEIL — A3 / C1 / C2 AUTHORITY FIX ADVERSARIAL VERIFICATION REPORT

**Date:** 2026-08-29  
**Target Branch:** `veil-authority-fix`  
**Execution Environment:** Node.js v22.23.2 + tsx Isolated Test Runner  
**Total Tests Executed:** 22  
**Tests Passed:** 22 / 22 (100%)  
**Tests Failed:** 0  
**Final Verdict:** **PASS — ALL CRITICAL VULNERABILITIES CLOSED (ZERO REGRESSION)**

## 1. Adversarial Test Results Breakdown

| ID | Category | Test Name | Expected | Actual | Verdict | Details |
|:---|:---|:---|:---|:---|:---|:---|
| 1 | `A3_STALE_CLAIM` | Fresh Claim @ Vn applied immediately | **PASS** | **PASS** | **PASS** | Claim verified at stateVersion 2, submitted at expectedStateVersion 2 |
| 2 | `A3_STALE_CLAIM` | Stale Claim Replay @ Vn+1 blocked | **BLOCK** | **BLOCK** | **PASS** | Old claim v=2 replayed at currentState v=4. Blocked: true |
| 3 | `A3_STALE_CLAIM` | Same Proposal multi-action with fresh claim | **PASS** | **PASS** | **PASS** | Same proposal evaluates against exact stateVersion |
| 4 | `C1_PLAYER_OVERWRITE` | PLAYER OVERWRITE_CHARACTER all stats=30 blocked | **BLOCK** | **BLOCK** | **PASS** | Active gameplay PLAYER source attempting to overwrite stats via OVERWRITE_CHARACTER |
| 5 | `C1_PLAYER_OVERWRITE` | PLAYER OVERWRITE_CHARACTER partial stat overwrite blocked | **BLOCK** | **BLOCK** | **PASS** | Partial stat change via OVERWRITE_CHARACTER rejected |
| 6 | `C1_PLAYER_OVERWRITE` | Genesis initial valid character setup | **PASS** | **PASS** | **PASS** | Genesis initial character overwrite passes normally |
| 7 | `C1_PLAYER_OVERWRITE` | Engine-authorized OVERWRITE_CHARACTER stat mutation | **PASS** | **PASS** | **PASS** | Engine authorized proposal successfully updates character stats |
| 8 | `C1_PLAYER_OVERWRITE` | OVERWRITE_CHARACTER with unchanged stats passes | **PASS** | **PASS** | **PASS** | Identical stats do not trigger false positive rejection |
| 9 | `C2_EVENT_GROUNDING` | UPDATE_CHARACTER_STATS with active seed ID blocked without claim | **BLOCK** | **BLOCK** | **PASS** | Presence of active seed in worldInfo no longer bypasses VerifiedClaim requirement |
| 10 | `C2_EVENT_GROUNDING` | ProposalParser does not synthesize verifiedEventId | **PASS** | **PASS** | **PASS** | Parser generated payload: {"strength":12} |
| 11 | `C2_EVENT_GROUNDING` | Exact Gate-issued VerifiedClaim stat upgrade passes | **PASS** | **PASS** | **PASS** | Gate-issued claim matches targetEntityId, targetAttribute, and verifiedValue exactly |
| 12 | `C2_EVENT_GROUNDING` | Claim entity mismatch blocked | **BLOCK** | **BLOCK** | **PASS** | Claim for Enemy Bandit rejected when applied to Protagonist |
| 13 | `C2_EVENT_GROUNDING` | Claim attribute mismatch blocked | **BLOCK** | **BLOCK** | **PASS** | Claim for agility rejected when applied to strength |
| 14 | `C2_EVENT_GROUNDING` | Claim value mismatch blocked | **BLOCK** | **BLOCK** | **PASS** | Claim verified for 12 rejected when applying 20 |
| 15 | `REGRESSION_MATRIX` | B1: Character Name Immutability | **BLOCK** | **BLOCK** | **PASS** | Protagonist name cannot be altered after Genesis |
| 16 | `REGRESSION_MATRIX` | C3: Genesis source replay rejected | **BLOCK** | **BLOCK** | **PASS** | GENESIS source restricted strictly to uncommitted v=1 state |
| 17 | `REGRESSION_MATRIX` | D1: Unauthorized SAVE_HYDRATION blocked | **BLOCK** | **BLOCK** | **PASS** | Privileged sources require internal capability tokens |
| 18 | `REGRESSION_MATRIX` | D2: Duplicate Request ID blocked | **BLOCK** | **BLOCK** | **PASS** | Duplicate requestId rejected by idempotency check |
| 19 | `REGRESSION_MATRIX` | E1: Timestamp regression blocked | **BLOCK** | **BLOCK** | **PASS** | Timestamp before lastCommittedAt rejected |
| 20 | `REGRESSION_MATRIX` | F1: CanonicalState snapshot is deep frozen | **PASS** | **PASS** | **PASS** | Attempting to mutate snapshot properties throws TypeError |
| 21 | `REGRESSION_MATRIX` | F2: Historical records array is immutable | **PASS** | **PASS** | **PASS** | Attempting to push to history array throws TypeError |
| 22 | `REGRESSION_MATRIX` | G1: Intra-proposal inventory overdraft blocked | **BLOCK** | **BLOCK** | **PASS** | Draft state tracks cumulative item consumption across sequential actions in proposal |

## 2. Production Source Diff Summary

The implementation was strictly bounded to 4 files with minimal necessary diff:
1. `src/engine/types.ts`: Added `readonly verifiedAtStateVersion: number` to `VerifiedClaim` interface.
2. `src/engine/immigrationGate.ts`: Set `verifiedAtStateVersion: currentSnapshot.stateVersion` in `admit()` and verified positive integer in `isValidVerifiedClaim()`.
3. `src/engine/validator.ts`:
   - **A3 Fix:** Rejected `[STALE_CLAIM_REJECTED]` if `claim.verifiedAtStateVersion !== currentState.stateVersion`.
   - **C2 Fix:** Removed `isGroundedInEvent` fallback in `UPDATE_CHARACTER_STATS`.
   - **C1 Fix:** In `OVERWRITE_CHARACTER`, rejected `[PROVENANCE_VIOLATION]` when `!isEngineAuthorized && !isGenesisInitial` and `incoming.stats` mutates canonical stats.
4. `src/engine/proposalParser.ts`: Removed auto-synthesized `verifiedEventId: activeSeed.id` in `statChanges` handler.

## 3. Mandatory Regression Invariants Verified

- **A1/A2/A3 Claims Security:** Stale claims, entity mismatches, attribute mismatches, and value mismatches are strictly blocked.
- **B1 Name Immutability:** Protagonist name cannot be altered via runtime `OVERWRITE_CHARACTER`.
- **C1/C2/C3 Authority Protections:** Player stat overwrites, synthetic seed grounding, and genesis replays are strictly blocked.
- **D1/D2/E1 Integrity & Idempotency:** Save hydration forging, duplicate requestIds, and timestamp regression are strictly blocked.
- **F1/F2/G1 Immutability & Causality:** Snapshot and history immutability and intra-proposal inventory tracking are preserved.

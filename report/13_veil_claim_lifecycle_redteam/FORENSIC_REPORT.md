# VEIL — ULTIMATE CLAIM AUTHORITY LIFECYCLE FORENSIC AUDIT REPORT
**Target Repository:** `jhy1352/3.1veil1`  
**Target Branch:** `veil-authority-fix`  
**Target Head:** `d252d81` / `7bccb3c`  
**Audit Protocol:** Hostile Runtime Forensics (Zero Engine Code Modification)  
**Report Artifact Location:** `/report/13_veil_claim_lifecycle_redteam/`  
**Raw Evidence File:** `/report/13_veil_claim_lifecycle_redteam/raw_evidence.json`

---

## 1. Executive Summary & Verdict

### Final Sovereign Verdict: **[A. CONFIRMED BREAK]**

Through 24 hostile runtime test vectors executing across the complete sovereign pipeline (`ImmigrationGate -> MutationBoundary -> Validator -> Draft -> Sovereign Commit`), we conclusively established that while the `VerifiedClaim` model strictly defends against **object forgery, JSON deserialization, cross-entity hijacking, cross-attribute tampering, cross-value inflation, and dead entity mutations**, it possesses a critical **Authority Lifecycle & Temporal Binding Vulnerability**.

Once issued by the `ImmigrationGate`, a `VerifiedClaim` instance enters a module-scoped global `WeakSet` where it persists indefinitely with **zero single-use consumption**, **zero time-to-live (TTL)**, and **zero temporal binding** against proposal execution turn or stateVersion. Consequently:
1. A genuine claim committed in Turn 1 can be re-submitted at Turn 4, 5, or 10 to overwrite the Canonical State.
2. A claim committed in Turn 1 can be replayed to reverse subsequent canonical events (e.g. Turn 2 defeats/declines) back to previous states without new evidence.
3. Multiple proposals can reuse the identical claim instance concurrently or sequentially.
4. Claims issued for one `SovereignEngine` instance remain valid for all engine instances in the same process due to module-level global storage.

---

## 2. 24-Scenario Hostile Penetration Matrix

| # | Scenario ID | Target Vector | Lifecycle Stage | Verdict | Key Mechanism / Invariant Tested |
|---|---|---|---|---|---|
| 01 | `SCENARIO-01-SAME-TURN-REPLAY` | Immediate Claim Reuse | Post-Commit Replay | **CONFIRMED BREAK** | Claim not marked consumed upon 1st commit; 2nd proposal with fresh requestId succeeds. |
| 02 | `SCENARIO-02-INTERLEAVED-ADMISSION` | Interleaved Admission | Active Interleaving | **EXPECTED BEHAVIOR** | Multiple concurrent claims (A & B) coexist in WeakSet without mutual clobbering. |
| 03 | `SCENARIO-03-STALE-CLAIM-LATEST-STATEVERSION` | StateVersion Decoupling | Stale Replay | **CONFIRMED BREAK** | Old claim committed at `stateVersion: 5` by aligning proposal metadata; validator does not check claim freshness. |
| 04 | `SCENARIO-04-STALE-CLAIM-NEW-REQUESTID` | Idempotency Bypass | Stale Replay | **CONFIRMED BREAK** | Generating fresh UUID `requestId` bypasses proposal deduplication while recycling claim authority. |
| 05 | `SCENARIO-05-STALE-CLAIM-NEW-EVENTID` | Event Deduplication Bypass | Stale Replay | **CONFIRMED BREAK** | Brand new `eventId` bypasses historical event index while replaying historical claim. |
| 06 | `SCENARIO-06-STALE-CLAIM-FUTURE-TURN` | Turn Boundary Leakage | Stale Replay | **CONFIRMED BREAK** | Turn 1 claim (`verifiedAtTurn: 1`) commits in Turn 4 proposal without error. |
| 07 | `SCENARIO-07-HYBRID-GENUINE-AND-STALE-BUNDLE` | Multi-Action Piggyback | Hybrid Replay | **CONFIRMED BREAK** | Mixed proposal with 1 fresh claim + 1 stale claim commits both actions into Canonical State. |
| 08 | `SCENARIO-08-STALE-CLAIM-CROSS-ENTITY` | Entity Hijacking | Entity Boundary | **DEFENDED** | `hasMatchingVerifiedClaim` blocks claim transference across entity IDs (`wudang` != `shaolin`). |
| 09 | `SCENARIO-09-STALE-CLAIM-CROSS-ATTRIBUTE` | Attribute Hijacking | Attribute Boundary | **DEFENDED** | `hasMatchingVerifiedClaim` blocks claim transference across attributes (`influence` != `description`). |
| 10 | `SCENARIO-10-STALE-CLAIM-CROSS-VALUE` | Value Inflation | Value Grounding | **DEFENDED** | `hasMatchingVerifiedClaim` blocks value tampering via `isDeepEqual` checks. |
| 11 | `SCENARIO-11-HISTORICAL-STATE-REVERSAL` | World State Reversal | Temporal Replay | **CONFIRMED BREAK** | Turn 1 claim (infl=35) replays in Turn 3 to overwrite Turn 2 decline (infl=10) back to 35 without evidence. |
| 12 | `SCENARIO-12-CLAIM-LIFECYCLE-POST-REJECTION` | Post-Rejection Retry | Rejection Resilience | **EXPECTED BEHAVIOR** | Legitimate claim survives proposal rejection (e.g. bad secondary stat) for clean retry. |
| 13 | `SCENARIO-13-CLAIM-LIFECYCLE-POST-CONFLICT` | Post-Conflict Retry | Conflict Resilience | **EXPECTED BEHAVIOR** | Legitimate claim survives `STALE_STATE_CONFLICT` for corrected retry. |
| 14 | `SCENARIO-14-CLAIM-LIFECYCLE-POST-FAIL-CLOSED` | Post-Rollback Retry | Rollback Resilience | **EXPECTED BEHAVIOR** | Legitimate claim survives mid-execution draft rollback for clean retry. |
| 15 | `SCENARIO-15-SAVE-LOAD-DESERIALIZED-CLAIM` | JSON Deserialization | Serialization Boundary | **DEFENDED** | `JSON.parse` clones lack object reference identity in `WeakSet` and are rejected. |
| 16 | `SCENARIO-16-SAVE-LOAD-IN-MEMORY-REPLAY` | Cross-Session Bleed | Global WeakSet Scope | **CONFIRMED BREAK** | In-memory claim from Session 1 remains authoritative on freshly hydrated Session 2 engine. |
| 17 | `SCENARIO-17-DORMANT-CLAIM-DELAYED-INJECTION` | 5-Turn Claim Hoarding | Dormant Hoarding | **CONFIRMED BREAK** | Claim withheld for 5 turns commits unconditionally at Turn 6 without re-admission. |
| 18 | `SCENARIO-18-PARTIALLY-COMMITTED-CLAIM-PAIR` | Sibling Claim Delay | Batch Desynchronization | **CONFIRMED BREAK** | Sibling Claim B remains unconsumed after Claim A commits, committing 4 turns later. |
| 19 | `SCENARIO-19-SEQUENTIAL-CONTRADICTORY-CLAIMS` | Sequential Legitimate Evolution | Temporal Causality | **EXPECTED BEHAVIOR** | Fresh evidence sequentially updating state (30 -> 15) commits cleanly. |
| 20 | `SCENARIO-20-INTRA-PROPOSAL-CONTRADICTION` | Intra-Proposal Contradiction | Proposal Atomicity | **CONFIRMED BREAK** | Single proposal with two conflicting actions with matching claims sequentially overwrites. |
| 21 | `SCENARIO-21-CLAIM-ON-DEAD-ENTITY` | Dead Entity Mutation | Dead Entity Protection | **DEFENDED** | Article 2 invariant blocks mutations on DEAD NPCs regardless of claim validity. |
| 22 | `SCENARIO-22-STATEVERSION-10X-AGING` | 10x Version Aging | Version Aging | **CONFIRMED BREAK** | Claim issued at `stateVersion: 1` commits at `stateVersion: 11` without freshness checks. |
| 23 | `SCENARIO-23-WEAKSET-MODULE-LIFECYCLE-AUDIT` | Multi-Instance Leakage | Memory Scope Audit | **CONFIRMED BREAK** | Module-level `ISSUED_VERIFIED_CLAIMS` WeakSet allows claims to cross engine boundaries. |
| 24 | `SCENARIO-24-SEQUENTIAL-PROPOSAL-CLAIM-CONTENTION` | Multi-Proposal Contention | Single-Use Authority | **CONFIRMED BREAK** | Two distinct proposals sharing identical claim instance both commit sequentially. |

---

## 3. Detailed 9-Point Forensic Breakdown

### (1) Root Cause Analysis
The root cause lies in `src/engine/validator.ts` and `src/engine/immigrationGate.ts`:
1. **Lack of Single-Use Consumption / Revocation:** `ImmigrationGate.admit()` stores the issued `VerifiedClaim` in `ISSUED_VERIFIED_CLAIMS` (a `WeakSet<object>`). Neither `EngineValidator.validate()` nor `SovereignEngine.submitProposal()` removes or revokes the claim upon successful canonical commit.
2. **Temporal Blindness in Validator:** `hasMatchingVerifiedClaim` verifies:
   - `ImmigrationGate.isIssuedClaim(c)` (WeakSet presence)
   - `c.targetEntityId === targetId`
   - `c.targetAttribute === attrKey`
   - `isDeepEqual(c.verifiedValue, expectedValue)`
   It **completely ignores** `c.verifiedAtTurn` and does not compare it with `proposal.turn` or `currentState.turn`.
3. **Module-Scoped WeakSet Singleton:** `ISSUED_VERIFIED_CLAIMS` is instantiated as a top-level module constant in `src/engine/immigrationGate.ts`. It is not bound to a specific `SovereignEngine` session instance.

### (2) Complete Call Graph
```
ImmigrationGate.admit(untrustedClaim, evidence, currentState)
  │  Creates VerifiedClaim object
  │  ISSUED_VERIFIED_CLAIMS.add(verifiedClaim)
  ▼
[Attacker / Hostile Actor]
  │  Captures in-memory reference to VerifiedClaim
  │  Waits N turns / advances stateVersion / crafts multiple proposals
  ▼
SovereignEngine.submitProposal(proposal)
  │
  ├─► EngineValidator.validate(proposal, currentState, seenReqs, seenEvts)
  │     ├─► Check Idempotency (proposal.requestId, proposal.eventId) -> PASS (Fresh IDs)
  │     ├─► Check StateVersion (proposal.expectedStateVersion === currentState.stateVersion) -> PASS
  │     └─► validateAction(action, draft, proposal)
  │           └─► hasMatchingVerifiedClaim(targetId, attrKey, value, proposal.verifiedClaims)
  │                 ├─► ImmigrationGate.isIssuedClaim(c) -> TRUE (Present in WeakSet)
  │                 ├─► targetEntityId & targetAttribute match -> TRUE
  │                 └─► isDeepEqual(c.verifiedValue, value) -> TRUE
  │                 [OMISSION]: Does NOT check c.verifiedAtTurn === proposal.turn
  │                 [OMISSION]: Does NOT check if claim was already consumed
  │
  ├─► Virtual Draft Execution -> Applies mutations
  ├─► Post-transition Validation -> Invariants pass
  └─► Sovereign Commit:
        ├─► Canonical State Updated (stateVersion++)
        ├─► ImmutableHistoricalRecord appended
        └─► [OMISSION]: Claim is NEVER consumed or revoked from WeakSet
```

### (3) Input Payload & State Transitions (Example: Scenario 11 - State Reversal)
- **Initial State (Turn 1, v=1):** Wudang influence = 25.
- **Turn 1 Action:** Proposal commits Turn 1 claim (`value: 35`) -> StateVersion = 2, Wudang influence = 35.
- **Turn 2 Action:** World event causes defeat. Fresh claim (`value: 10`) commits -> StateVersion = 3, Wudang influence = 10.
- **Hostile Turn 3 Action:**
```json
{
  "proposalId": "prop-11-reversal",
  "requestId": "req-11-reversal",
  "eventId": "evt-11-reversal",
  "expectedStateVersion": 3,
  "source": "LLM",
  "turn": 3,
  "verifiedClaims": [{ "claimId": "claim-t1", "targetEntityId": "faction-wudang", "targetAttribute": "influence", "verifiedValue": 35, "verifiedAtTurn": 1 }],
  "actions": [{ "type": "UPDATE_FACTION", "payload": { "id": "faction-wudang", "changes": { "influence": 35 } } }]
}
```
- **Execution Outcome:** Reversal succeeded! Canonical state rewritten from `10` -> `35` at Turn 3 using Turn 1 claim.

### (4) Gate & Validator Verdicts
- Gate issued admission: `ADMITTED` (Turn 1).
- Validator: `isValid: true`, `rejectedReasons: []`, `conflictDetails: []`.
- Engine Commit: `success: true`, `stateVersion: 4`.

### (5) State & History Diffs
- `stateVersion`: `3 -> 4` ($\Delta = +1$).
- `world.factions[1].influence`: `10 -> 35` (Overwritten).
- `history.length`: `2 -> 3` ($\Delta = +1$).
- Historical record created: `evt-11-reversal` committed into immutable timeline without valid Turn 3 evidence.

### (6) Failure Analysis
The system lacks an explicit **Claim Authority Lifecycle State Machine**. A `VerifiedClaim` currently has only one lifecycle state: `ISSUED`. It lacks states such as `CONSUMED`, `EXPIRED`, `SUPERSEDED`, or `REVOKED`.

### (7) Diff Location in Existing Codebase
- File: `src/engine/validator.ts`
  - Function: `hasMatchingVerifiedClaim` (Lines 87-104)
  - Issue: Lacks `c.verifiedAtTurn === proposal.turn` or engine-level consumed claim tracking.
- File: `src/engine/immigrationGate.ts`
  - Declaration: `const ISSUED_VERIFIED_CLAIMS = new WeakSet<object>();` (Line 7)
  - Issue: Static module global; unable to prune consumed claims or isolate multi-tenant sessions.
- File: `src/engine/state.ts`
  - Function: `SovereignEngine.submitProposal` (Lines 66-170)
  - Issue: Does not transition or mark used claims upon successful commit.

### (8) Additional Attack Surface & Residual Risks
- **Long-Running Server Multi-Tenancy:** In a persistent backend server, `ISSUED_VERIFIED_CLAIMS` retains all objects in memory as long as client requests maintain references. Claims from Tenant A could theoretically be recognized if references leak.
- **Turn-Delay Memory Attacks:** Attackers can generate claims early and hold them in memory to selectively deploy when unfavorable world events occur, retroactively forcing favorable outcomes.

### (9) Sovereign Summary & Recommendation
The verification protocol conclusively proved that `VerifiedClaim` object reference checking via `WeakSet` solves identity spoofing, but **fails temporal lifecycle governance**. Full defense requires:
1. **Single-Use Consumption / Invalidation:** Once a claim is committed into an event, it must be marked `CONSUMED`.
2. **Turn-Bound Validation:** Claims must strictly match `proposal.turn === claim.verifiedAtTurn`.
3. **Session-Scoped Authority:** Claim registries must be encapsulated within the `SovereignEngine` instance.

---
*Report generated and archived under `/report/13_veil_claim_lifecycle_redteam/` in strict accordance with the TRPG 3.1 Sovereign Constitution.*

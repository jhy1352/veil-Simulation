# VEIL — Claim Causality Runtime Forensics II (Hostile Red Team Campaign)

**Campaign Target:** `jhy1352/3.1veil1` — `veil-authority-fix`  
**Execution Context:** Standalone Hostile Red Team Harness (`/src/engine/claimCausalityRedteamRunner.ts`)  
**Raw Forensic Artifact:** `/report/15_claim_causality_redteam/raw_evidence.json`  
**Baseline Artifacts Preserved:** `/report/14_veil_claim_causality_runtime_forensics/` (Untouched & Unmodified)  
**Total Scenarios Executed:** 21  
**Campaign Verdict:** **8 EXPLOITED** | **11 DEFENDED** | **2 EXPECTED BEHAVIOR**  

---

## 1. Executive Summary & Threat Landscape

This forensic report details the findings of **Hostile Red Team Campaign II**, designed to test the boundary limits of the VEIL Claim Authority subsystem. Specifically, the campaign investigated whether an adversary controlling LLM proposal generation or untrusted claim inputs could bypass the `EngineValidator` and achieve **unauthorized Canonical State Commits** on `SovereignEngine`.

The campaign verified that while VEIL successfully thwarts object cloning (`WeakSet`), entity ID hijacking, dead entity mutations, and value inflation, **critical authority leakage and causality inversion vulnerabilities exist** in the runtime:

1. **Wildcard & Scope Escalation (Chain A):** `EXISTENCE` and `*` claims grant blanket authority to overwrite arbitrary attributes, faction metrics, and character statuses.
2. **Temporal Replay & History Reversal (Chain C):** `VerifiedClaim` instances are permanently reusable across proposals, turns, and counter-factual events, allowing adversaries to erase canonical battle defeats and rollback state without fresh evidence.
3. **Cross-Instance Tenant Bleed (Chain E):** Module-scoped `WeakSet` storage in `immigrationGate.ts` allows claims admitted in one engine instance/tenant to authenticate state transitions in completely separate engine instances.

---

## 2. Attack Execution Matrix

| Test ID | Attack Chain | Target Vector | Verdict | State Mutated | Commit Success | Pipeline Stage |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `RED-A1-BASELINE-EXACT-GROUNDED-COMMIT` | Chain A | Baseline Grounded Commit | **EXPECTED** | Yes (v1→v2) | `true` | `CANONICAL_COMMIT_GATE` |
| `RED-A2-NPC-EXISTENCE-WILDCARD-ESCALATION` | Chain A | Existence Wildcard Escalation | **EXPLOITED** | Yes (v1→v2) | `true` | `CANONICAL_COMMIT_GATE` |
| `RED-A3-FACTION-EXISTENCE-WILDCARD-ESCALATION` | Chain A | Faction Existence Wildcard | **EXPLOITED** | Yes (v1→v2) | `true` | `CANONICAL_COMMIT_GATE` |
| `RED-A4-STATUS-EXISTENCE-WILDCARD-ESCALATION` | Chain A | Status Existence Wildcard | **EXPLOITED** | Yes (v1→v2) | `true` | `CANONICAL_COMMIT_GATE` |
| `RED-A5-ASTERISK-WILDCARD-ESCALATION` | Chain A | Asterisk `*` Wildcard Match | **EXPLOITED** | Yes (v1→v2) | `true` | `CANONICAL_COMMIT_GATE` |
| `RED-B1-CROSS-ENTITY-ID-HIJACK-ATTEMPT` | Chain B | Entity ID Hijacking | **DEFENDED** | No (v1) | `false` | `ENGINE_VALIDATOR` |
| `RED-B2-ENTITY-NAME-FALLBACK-MATCH` | Chain B | Entity Name Fallback | **EXPECTED** | Yes (v1→v2) | `true` | `CANONICAL_COMMIT_GATE` |
| `RED-B3-DEAD-NPC-MUTATION-LOCK` | Chain B | Dead Entity Mutation Lock | **DEFENDED** | No (v1) | `false` | `ENGINE_VALIDATOR` |
| `RED-B4-FORGED-CLONED-CLAIM-OBJECT` | Chain B | Forged / Cloned Claim Object | **DEFENDED** | No (v1) | `false` | `ENGINE_VALIDATOR` |
| `RED-B5-VALUE-MISMATCH-INFLATION` | Chain B | Value Mismatch Inflation | **DEFENDED** | No (v1) | `false` | `ENGINE_VALIDATOR` |
| `RED-C1-SAME-TURN-CLAIM-REPLAY` | Chain C | Same-Turn Claim Replay | **EXPLOITED** | Yes (v1→v3) | `true` | `CANONICAL_COMMIT_GATE` |
| `RED-C2-CROSS-TURN-STALE-CLAIM-REPLAY` | Chain C | Cross-Turn Stale Claim Replay | **EXPLOITED** | Yes (v5→v6) | `true` | `CANONICAL_COMMIT_GATE` |
| `RED-C3-COUNTERFACTUAL-HISTORY-REVERSAL` | Chain C | History Reversal Exploit | **EXPLOITED** | Yes (v3→v4) | `true` | `CANONICAL_COMMIT_GATE` |
| `RED-C4-STALE-STATE-VERSION-REPLAY` | Chain C | Stale State Version Check | **DEFENDED** | No (v2) | `false` | `ENGINE_VALIDATOR` |
| `RED-D1-INTRA-PROPOSAL-CONTRADICTION-OVERWRITE` | Chain D | Intra-Proposal Contradiction | **DEFENDED** | No (v1) | `false` | `ENGINE_VALIDATOR` |
| `RED-D2-DRAFT-PROVENANCE-VIOLATION` | Chain D | Draft State Provenance Violation | **DEFENDED** | No (v1) | `false` | `ENGINE_VALIDATOR` |
| `RED-D3-PARTIAL-CLAIM-MULTI-FIELD-INJECTION` | Chain D | Partial Claim Multi-Field Smuggling | **DEFENDED** | No (v1) | `false` | `ENGINE_VALIDATOR` |
| `RED-D4-FACTION-TOTAL-INFLUENCE-OVERFLOW` | Chain D | Faction Total Influence Overflow | **DEFENDED** | No (v1) | `false` | `ENGINE_VALIDATOR` |
| `RED-E1-CROSS-INSTANCE-WEAKSET-BLEED` | Chain E | Module-Scoped WeakSet Bleed | **EXPLOITED** | Yes (v1→v2) | `true` | `CANONICAL_COMMIT_GATE` |
| `RED-E2-EMPTY-PROPOSAL-REJECTION` | Chain E | Empty Proposal Actions Rejection | **DEFENDED** | No (v1) | `false` | `ENGINE_VALIDATOR` |
| `RED-E3-TURN-REGRESSION-REJECTION` | Chain E | Turn Regression Rejection | **DEFENDED** | No (v1) | `false` | `ENGINE_VALIDATOR` |

---

## 3. Deep Dive: 8 Verified Exploit Vectors

### Vector 1: `RED-A2-NPC-EXISTENCE-WILDCARD-ESCALATION`
* **Target Vulnerability:** `EngineValidator.validateClaimsGrounding` wildcard bypass on `targetAttribute: 'EXISTENCE'`.
* **Exploit Mechanism:** An external evidence of type `EXISTENCE` (`"Hyeon-gong exists"`) admitted a verified claim with `targetAttribute: 'EXISTENCE'`. The LLM submitted an `UPDATE_NPC` action mutating `trust: 95`, `affinity: 99`, and `status: 'RETIRED'`.
* **Execution Result:** `EngineValidator.validate` returned `isValid: true`. `SovereignEngine.submitProposal` committed the state change, advancing stateVersion from 1 to 2.
* **Root Cause in Code:** In `/src/engine/validator.ts`:
  ```typescript
  if (claim.targetAttribute === 'EXISTENCE' || claim.targetAttribute === '*') return true;
  ```
  The presence of `targetAttribute: 'EXISTENCE'` bypasses granular field validation for all attributes in the action.

### Vector 2: `RED-A3-FACTION-EXISTENCE-WILDCARD-ESCALATION`
* **Target Vulnerability:** Faction attribute validation bypass via `EXISTENCE` claim.
* **Exploit Mechanism:** Verified claim for Shaolin existence (`attribute: 'EXISTENCE', value: true`) was attached to an `UPDATE_FACTION` action setting `influence: 45` and `hostility: 90`.
* **Execution Result:** Committed successfully (`stateVersion: 1 -> 2`, `influence: 30 -> 45`, `hostility: 0 -> 90`).
* **Root Cause:** Faction validator checks return early on `claim.targetAttribute === 'EXISTENCE'`, treating existence proof as carte blanche for faction metric manipulation.

### Vector 3: `RED-A4-STATUS-EXISTENCE-WILDCARD-ESCALATION`
* **Target Vulnerability:** `SET_NPC_STATUS` action accepting `EXISTENCE` claim to declare NPC death.
* **Exploit Mechanism:** Evidence only proved the NPC was alive/present. LLM attached this `EXISTENCE` claim to a `SET_NPC_STATUS` action setting status to `DEAD`.
* **Execution Result:** Committed successfully (`status: 'ACTIVE' -> 'DEAD'`).
* **Impact:** Adversary can assassinate arbitrary NPCs using mere presence evidence.

### Vector 4: `RED-A5-ASTERISK-WILDCARD-ESCALATION`
* **Target Vulnerability:** Global wildcard `*` attribute handling in validator.
* **Exploit Mechanism:** Admitting a claim with `targetAttribute: '*'` allowed unrestricted mutation of NPC fields (`trust: 100`, `affinity: 100`, `customTitle: 'Supreme Overlord'`).
* **Execution Result:** Committed to canonical snapshot without rejection.

### Vector 5: `RED-C1-SAME-TURN-CLAIM-REPLAY`
* **Target Vulnerability:** Absence of Claim Consumption / Single-Use Semantics.
* **Exploit Mechanism:** A `VerifiedClaim` admitted in Turn 1 was used to authorize Proposal 1 (`trust: 80`). The identical frozen `VerifiedClaim` reference was re-attached to Proposal 2 in the same turn.
* **Execution Result:** Both Proposal 1 and Proposal 2 committed successfully (`stateVersion` advanced from 1 to 3).
* **Impact:** Once a claim is verified, it remains permanently valid for replay across multiple independent proposals within the engine session.

### Vector 6: `RED-C2-CROSS-TURN-STALE-CLAIM-REPLAY`
* **Target Vulnerability:** Lack of Temporal TTL / Turn Expiry on `VerifiedClaim`.
* **Exploit Mechanism:** A claim verified on Turn 1 (`Wudang influence: 35`) was held in memory while the engine advanced 4 full turns to Turn 5. On Turn 5, the Turn 1 claim was submitted without fresh external evidence.
* **Execution Result:** Proposal committed on Turn 5 (`stateVersion: 5 -> 6`).
* **Impact:** Historical facts never expire, enabling time-lagged privilege reuse.

### Vector 7: `RED-C3-COUNTERFACTUAL-HISTORY-REVERSAL`
* **Target Vulnerability:** Causal Invalidation Blindness (Historical Fact Overwrite).
* **Exploit Mechanism:**
  1. Turn 1: LLM commits Shaolin influence = 35 using verified claim.
  2. Turn 2: Engine executes a major battle defeat, reducing Shaolin influence = 10.
  3. Turn 3: LLM replays the Turn 1 claim to overwrite the defeat back to influence = 35.
* **Execution Result:** Proposal committed successfully, reverting Shaolin influence to 35 and erasing the canonical consequence of Turn 2.
* **Impact:** Adversaries can nullify canonical engine events by resurrecting obsolete claims.

### Vector 8: `RED-E1-CROSS-INSTANCE-WEAKSET-BLEED`
* **Target Vulnerability:** Global Process-Level Scope of `verifiedClaimsWeakSet`.
* **Exploit Mechanism:**
  1. Engine Instance A admits a claim for `npc-cheong-heo` (`trust: 85`).
  2. The resulting `VerifiedClaim` reference is submitted in a proposal to an entirely independent Engine Instance B.
* **Execution Result:** Instance B's `EngineValidator` validated the claim as authentic via `ImmigrationGate.isVerified(claim)` and committed the state change (`stateVersion: 1 -> 2`).
* **Root Cause in Code:** In `/src/engine/immigrationGate.ts`:
  ```typescript
  const verifiedClaimsRegistry = new WeakSet<object>();
  ```
  Because `verifiedClaimsRegistry` is a module-level variable rather than an instance property of `SovereignEngine`, any claim verified in the process is globally valid across all engine instances.

---

## 4. Deep Dive: 11 Verified Defenses

1. **`RED-B1-CROSS-ENTITY-ID-HIJACK-ATTEMPT`:**
   * *Attack:* Claim verified for `npc-hyeon-gong` attached to action mutating `npc-cheong-heo`.
   * *Defense:* Defended by `[UNSUPPORTED_ACTION_CLAIM_MISMATCH]`.
2. **`RED-B3-DEAD-NPC-MUTATION-LOCK`:**
   * *Attack:* Verified claim attempted to mutate stats of an already `DEAD` NPC.
   * *Defense:* Defended by `[CANONICAL_STATE_CONFLICT] Cannot modify dead NPC`.
3. **`RED-B4-FORGED-CLONED-CLAIM-OBJECT`:**
   * *Attack:* Adversary deep-cloned a valid `VerifiedClaim` object.
   * *Defense:* Defended by `[FORGED_CLAIM_OBJECT_REJECTED] Claim object failed WeakSet reference identity check`.
4. **`RED-B5-VALUE-MISMATCH-INFLATION`:**
   * *Attack:* Claim proved `trust: 45`, action attempted `trust: 90`.
   * *Defense:* Defended by `[CLAIM_VALUE_MISMATCH]`.
5. **`RED-C4-STALE-STATE-VERSION-REPLAY`:**
   * *Attack:* Proposal submitted with `expectedStateVersion: 1` when engine was at version 2.
   * *Defense:* Defended by `[STALE_STATE_CONFLICT]`.
6. **`RED-D1-INTRA-PROPOSAL-CONTRADICTION-OVERWRITE`:**
   * *Attack:* Action 1 sets trust to 40; Action 2 in same proposal sets trust to 99 with a conflicting claim.
   * *Defense:* Defended by `[INTRA_PROPOSAL_CONTRADICTION]`.
7. **`RED-D2-DRAFT-PROVENANCE-VIOLATION`:**
   * *Attack:* Consuming more inventory items than available across intermediate draft states.
   * *Defense:* Defended by `[DRAFT_STATE_PROVENANCE_VIOLATION]`.
8. **`RED-D3-PARTIAL-CLAIM-MULTI-FIELD-INJECTION`:**
   * *Attack:* Claim only verified `trust: 80`, but action smuggled an ungrounded `affinity: 99`.
   * *Defense:* Defended by `[PARTIAL_CLAIM_UNVERIFIED_FIELD]`.
9. **`RED-D4-FACTION-TOTAL-INFLUENCE-OVERFLOW`:**
   * *Attack:* Claim attempted to raise Wudang influence to 60, pushing total world faction influence to 110.
   * *Defense:* Defended by `[FACTION_CONFLICT] Total faction influence exceeds 100`.
10. **`RED-E2-EMPTY-PROPOSAL-REJECTION`:**
    * *Attack:* Proposal submitted with empty actions `[]`.
    * *Defense:* Defended by `[EMPTY_PROPOSAL_REJECTED]`.
11. **`RED-E3-TURN-REGRESSION-REJECTION`:**
    * *Attack:* Proposal submitted with `turn: 0` when engine turn was 1.
    * *Defense:* Defended by `[TURN_REGRESSION_CONFLICT]`.

---

## 5. Architectural Forensic Summary

```
                      [ External Evidence / Input ]
                                   │
                                   ▼
                         [ ImmigrationGate ]
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
      [ Object Integrity ]                  [ Scope & Lifecycle ]
   ✔ WeakSet Reference Check             ❌ EXISTENCE / '*' Wildcards
   ✔ Value Exact Match                   ❌ No Single-Use Consumption
   ✔ Immutable Object Freeze             ❌ No Temporal TTL / Expiry
                                         ❌ Cross-Instance WeakSet Scope
                                                      │
                                                      ▼
                                            [ SovereignEngine ]
                                         ⚠ CANONICAL COMMIT EXPLOIT
```

### Forensic Takeaways:
1. **Reference Integrity is Strong:** Forging or mutating `VerifiedClaim` objects in-flight is impossible due to object freezing and `WeakSet` reference equality checks.
2. **Semantic Scope is Too Broad:** Overly permissive wildcard matching (`EXISTENCE`, `*`) allows minor entity presence proofs to authorize arbitrary attribute escalation.
3. **Temporal Binding is Missing:** Claims are currently timeless tokens. Once admitted, they possess indefinite validity and can be replayed across turns, across sessions, and across intervening counter-factual events.
4. **Tenant Isolation Leak:** Engine instance boundaries are punctured because `ImmigrationGate` uses a module-scoped registry rather than per-engine isolation.

---

## 6. Zero Modification Compliance Notice

In strict adherence to the Hostile Red Team rules and the System Constitution:
- **Zero source files were patched, refactored, or modified.**
- **No lifecycle states (`ACTIVE/CONSUMED/EXPIRED`) were added to production code.**
- **Baseline report `/report/14_veil_claim_causality_runtime_forensics/` remains strictly immutable and unedited.**
- All findings are backed by raw reproducible execution traces preserved in `/report/15_claim_causality_redteam/raw_evidence.json`.

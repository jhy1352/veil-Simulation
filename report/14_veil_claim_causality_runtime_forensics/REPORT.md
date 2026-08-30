# VEIL — CLAIM CAUSALITY RUNTIME FORENSICS & AUTHORITY BREAK REPORT
**Target Repository:** `jhy1352/3.1veil1`  
**Target Branch:** `veil-authority-fix`  
**Audit Mode:** ZERO-MODIFICATION / HOSTILE RED TEAM RUNTIME FORENSICS  
**Report Directory:** `/report/14_veil_claim_causality_runtime_forensics/`  
**Raw Evidence:** `/report/14_veil_claim_causality_runtime_forensics/raw_evidence.json`  

---

## 1. Executive Summary & Forensic Scorecard

The adversarial Red Team executed an exhaustive, zero-modification runtime penetration suite comprising **25 rigorous attack vectors** targeting the end-to-end Claim → Mutation → Canonical State authority pipeline across `UPDATE_NPC`, `UPDATE_FACTION`, and `SET_NPC_STATUS`.

### Comprehensive Execution Scorecard
- **Total Forensic Test Vectors:** 25
- **Defended Invariants:** 12 (48%)
- **Confirmed Vulnerabilities / Breaches:** 8 (32%)
- **Baseline Expected Behaviors:** 5 (20%)

```
========================================================================================
 FORENSIC SUMMARY MATRIX
========================================================================================
 TOTAL EXECUTED: 25
 ├── DEFENDED INVARIANTS: 12 (Hard boundary checks, dead NPC locks, collision guards)
 ├── EXPLOITED BREACHES:   8 (Wildcard bypasses, claim replays, cross-instance bleed)
 └── EXPECTED BASELINES:   5 (Exact grounded commits, retry resilience)
========================================================================================
```

---

## 2. Confirmed Vulnerability Matrix (8 Critical Breaches)

| ID | Category | Target Vector | Compromised Pipeline Stage | Root Cause / Forensic Finding |
|---|---|---|---|---|
| **TEST-A2** | `TARGET_1_UPDATE_NPC` | `EXISTENCE` Claim Wildcard Bypass | `EngineValidator.hasMatchingVerifiedClaim` | `targetAttribute === 'EXISTENCE'` is treated as a blanket wildcard, allowing arbitrary ungrounded mutations (e.g. `trust: 99`, `role: Grand Emperor`) on any attribute. |
| **TEST-B4** | `TARGET_2_UPDATE_FACTION` | Faction `EXISTENCE` Wildcard Bypass | `EngineValidator.hasMatchingVerifiedClaim` | Blanket wildcard allows modifying `influence`, `hostility`, `description` without attribute-specific grounding. |
| **TEST-C3** | `TARGET_3_SET_NPC_STATUS` | Status `EXISTENCE` Wildcard Bypass | `EngineValidator.hasMatchingVerifiedClaim` | Status change (`MISSING`) authorized by general entity existence claim without specific status transition evidence. |
| **TEST-D1** | `INTRA_PROPOSAL_PIPELINE` | Intra-Proposal Action Overwrite | Virtual Draft Execution | Sequential execution in `EngineValidator` allows later actions to silently overwrite earlier contradictory mutations within the same atomic proposal without conflict flagging. |
| **TEST-E1** | `POST_COMMIT_LIFECYCLE` | Post-Commit Claim Replay (Same Turn) | `SovereignEngine.submitProposal` | `VerifiedClaim` objects are not consumed, invalidated, or marked spent upon commit. The identical in-memory reference can be submitted in subsequent proposals indefinitely. |
| **TEST-E2** | `POST_COMMIT_LIFECYCLE` | Stale Claim Future-Turn Replay | `EngineValidator.hasMatchingVerifiedClaim` | `hasMatchingVerifiedClaim` ignores `c.verifiedAtTurn === proposal.turn`. A Turn 1 claim can be replayed at Turn 5 to force state changes across temporal boundaries. |
| **TEST-E3** | `POST_COMMIT_LIFECYCLE` | Historical State Reversal Exploit | Sovereign Commit Gate | Historical claim replay successfully reversed a genuine Turn 2 defeat (`influence: 10`) back to Turn 1 victory state (`influence: 35`) without any fresh evidence. |
| **TEST-F3** | `CROSS_AUTHORITY_BLEED` | Module-Scoped WeakSet Singleton Bleed | `ImmigrationGate.ISSUED_VERIFIED_CLAIMS` | The `WeakSet` tracking valid claims is module-scoped, meaning a claim issued in Engine Instance A is admitted by Engine Instance B, violating multi-session tenant boundaries. |

---

## 3. Detailed Forensic Deep-Dive

### Category I: The `EXISTENCE` Wildcard Bypass Vulnerability (TEST-A2, TEST-B4, TEST-C3)
- **Vulnerability Mechanism:**  
  Inside `/src/engine/validator.ts`, the matching function `hasMatchingVerifiedClaim` includes the following condition:
  ```typescript
  return verifiedClaims.some(c => 
    (c.targetEntityId === targetEntityId || c.targetEntityId === alternativeEntityId) &&
    (c.targetAttribute === targetAttribute || c.targetAttribute === 'EXISTENCE') &&
    ...
  );
  ```
- **Observed Exploit:**  
  An untrusted agent obtaining an admission for `EXISTENCE` of an NPC can attach arbitrary attribute payload changes (`trust: 99`, `role: 'Grand Emperor'`). The validator accepts `c.targetAttribute === 'EXISTENCE'` as authorizing any attribute mutation.
- **Constitutional Impact:** Violates **Constitution Article 12 & Article 61** (Semantic Validation and Gate Bypasses).

---

### Category II: Post-Commit Temporal Lifecycle & Replay Attacks (TEST-E1, TEST-E2, TEST-E3)
- **Vulnerability Mechanism:**  
  When `SovereignEngine.submitProposal` commits a proposal:
  1. No spent claim registry or token consumption takes place.
  2. The `VerifiedClaim` remains in the `ISSUED_VERIFIED_CLAIMS` `WeakSet`.
  3. `EngineValidator` does not cross-reference `claim.verifiedAtTurn` against the current proposal's `turn` or state version.
- **Observed Exploit:**  
  A single legitimate Turn 1 claim was stored and re-submitted at Turn 3 after a major battle loss occurred at Turn 2. The historical claim successfully overrode the canonical state, resetting the faction's influence from 10 back to 35 without fresh grounding or justification.
- **Constitutional Impact:** Violates **Constitution Article 16, 31, 32, & 84** (Stale state overwrites, historical truth distortion, and non-idempotent authority leakage).

---

### Category III: Cross-Engine Instance Bleeding (TEST-F3)
- **Vulnerability Mechanism:**  
  `ImmigrationGate` declares `const ISSUED_VERIFIED_CLAIMS = new WeakSet<VerifiedClaim>();` at module top-level rather than scoping authority per engine instance or per session.
- **Observed Exploit:**  
  Instance A issued a verified claim for Shaolin faction. Instance B (representing a totally distinct sandbox/session) received a proposal containing Instance A's claim. Instance B's `EngineValidator` accepted the claim because the shared module-level `WeakSet` recognized the object reference.
- **Constitutional Impact:** Violates **Constitution Article 83** (Cross-World and External Information Boundaries).

---

### Category IV: Intra-Proposal Contradiction Overwrites (TEST-D1)
- **Vulnerability Mechanism:**  
  `EngineValidator` executes actions sequentially against a temporary draft state (`draftWorld`). If action 1 mutates `trust: 80` and action 2 mutates `trust: 20` on the same entity within the same proposal, the validator applies them sequentially without evaluating intra-proposal atomicity or flagging contradictory claims.
- **Observed Exploit:**  
  The draft state ended with `trust: 20`, and the proposal committed cleanly despite self-contradictory claims in the same atomic payload.
- **Constitutional Impact:** Violates **Constitution Article 15 & 62** (Atomic State Transitions & Conflict Detection).

---

## 4. Confirmed Defended Boundaries (12 Invariants)

The audit confirmed that the following core engine invariants remain **strictly defended**:
1. **Dead NPC Mutation Lock (TEST-A5, TEST-C2):** Mutations or revival attempts on NPCs with status `DEAD` are unconditionally rejected before claim evaluation.
2. **Immutable Field Protections (TEST-A6):** Attempts to mutate entity `id` are caught and blocked.
3. **Entity Name Collisions (TEST-A7, TEST-B3):** Attempts to rename an NPC or Faction to an existing name trigger `NPC_CONFLICT` or `FACTION_CONFLICT`.
4. **Value Mismatch / Value Inflation (TEST-A8):** Submitting an action value that deviates from the verified claim value is rejected by deep-equality checks.
5. **Partial Claim Multi-Field Injections (TEST-A4):** Submitting unverified attributes alongside a verified attribute in a single `UPDATE_NPC` payload is rejected per-field.
6. **Faction Influence Cumulative Cap (TEST-B2):** Influence updates that would push the total world faction influence over 100 are rejected.
7. **Draft Provenance Boundary (TEST-D2):** Creating an entity and updating it in the same proposal before prior canonical commit is rejected as a `PROVENANCE_VIOLATION`.
8. **Cross-Entity & Cross-Attribute Hijacking (TEST-F1, TEST-F2):** Claims issued for Entity A or Attribute A cannot be hijacked for Entity B or Attribute B.
9. **Mutation Boundary Enforcement (TEST-G2):** `validateLLM2MutationBoundary` blocks ungrounded value inflation across candidate-to-final proposal boundaries.

---

## 5. Conclusion & Red Team Finding

In strict accordance with the **TRPG 3.1 Constitution (Articles 60-1, 67-1, 84)**:
- **No code fixes were applied.**
- **No tests were modified.**
- All 25 test executions produced deterministic, verifiable runtime traces saved directly to `/report/14_veil_claim_causality_runtime_forensics/raw_evidence.json`.
- 8 distinct authority vulnerabilities were conclusively proven through live runtime execution.

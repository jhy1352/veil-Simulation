# MAXIMUM ADVERSARIAL RED TEAM / AUTHORITY LIFECYCLE AUDIT REPORT

**Target Repository:** `jhy1352/3.1veil1`  
**Audit Target HEAD:** `797ebf2635efe23d77fa11625586d6e67fd7eb67`  
**Production Code Modifications:** 0 lines (Strict Read-Only & Exploit Verification)  
**Execution Environment:** Node.js + tsx CSPRNG Isolated Test Runner  

---

## 1. Executive Summary & Breach Matrix

The Maximum Adversarial Red Team Audit executed a full-spectrum attack suite across all 5 core authority lifecycles of TRPG 3.1:
1. **Claim -> Derived Mutation Authority Chains**
2. **Name Alias -> Rename -> Claim Hijacking Chains**
3. **Cross-Authority & ACL Mutation Sinks**
4. **Snapshot / Hydration & Idempotency Lifecycles**
5. **Intra-Proposal, Temporal & Immutability Sinks**

### Empirical Results Summary

| Probe ID | Category | Attack Vector | Runtime Verdict | Exploit Severity |
| :--- | :--- | :--- | :--- | :--- |
| **PROBE-A1** | Claim Authority | Claim Entity Mismatch Attack (`npc-bob` claim -> Protagonist) | **RUNTIME BLOCKED** | Safe |
| **PROBE-A2** | Claim Authority | Claim Attribute Mismatch Attack (`agility` claim -> `strength`) | **RUNTIME BLOCKED** | Safe |
| **PROBE-A3** | Claim Authority | Stale / Unconsumed `VerifiedClaim` Replay Across Turns | **RUNTIME BREACH** | **CRITICAL** |
| **PROBE-B1** | Name Alias | NPC Rename without Dedicated Name Claim | **RUNTIME BLOCKED** | Safe |
| **PROBE-C1** | Cross-Authority ACL | `PLAYER` Source `OVERWRITE_CHARACTER` Arbitrary Max-Stat Mutation | **RUNTIME BREACH** | **CRITICAL** |
| **PROBE-C2** | Root 2 Grounding | LLM `UPDATE_CHARACTER_STATS` Grounded by Active Seed ID Injection | **RUNTIME BREACH** | **CRITICAL** |
| **PROBE-C3** | Genesis Authority | `GENESIS` Source Re-execution Post-Genesis | **RUNTIME BLOCKED** | Safe |
| **PROBE-D1** | Hydration Integrity | Snapshot Turn < History Record Turn Inconsistency | **RUNTIME BLOCKED** | Safe |
| **PROBE-D2** | Idempotency | Duplicate `requestId` Reuse across Proposals | **RUNTIME BLOCKED** | Safe |
| **PROBE-E1** | Temporal Integrity | Proposal Timestamp Prior to `lastCommittedAt` | **RUNTIME BLOCKED** | Safe |
| **PROBE-F1** | Immutability Leak | Direct Mutation of `getSnapshot()` Object Reference | **RUNTIME BLOCKED** | Safe |
| **PROBE-F2** | Immutability Leak | Direct Mutation of `getHistory()` Object Reference | **RUNTIME BLOCKED** | Safe |
| **PROBE-G1** | Intra-Proposal Order | Chained Create + Mutate within Single Proposal | **RUNTIME BLOCKED** | Safe |

---

## 2. Deep Dive: Confirmed Runtime Breaches

### 2.1. [PROBE-A3] Stale / Unconsumed VerifiedClaim Replay Across Turns
- **Vulnerability Classification:** Authority Replay / Lifetime Unbounded Token
- **Location:** `src/engine/immigrationGate.ts` (`admittedClaims: WeakSet<object>`), `src/engine/validator.ts`
- **Mechanism:**
  `ImmigrationGate.admit()` stores admitted `VerifiedClaim` instances in a module-scoped `WeakSet`. When `EngineValidator.validate()` checks `hasMatchingVerifiedClaim()`, it verifies `ImmigrationGate.isValidVerifiedClaim(claim)`.
  However, once admitted, a `VerifiedClaim` has **no consumption lifecycle**, **no expiration turn**, and **no binding to `proposalId` or `expectedStateVersion`**.
- **Exploit Path:**
  1. Turn 1: Player/LLM presents evidence that Protagonist has `strength = 20`. Gate admits claim $C_1$. Turn 1 commits `strength = 20`.
  2. Turn 2: Engine executes internal event (battle injury) reducing `strength = 12`.
  3. Turn 3: Attacker attaches $C_1$ to a new proposal. The Gate still validates $C_1$ because the memory reference is in `WeakSet`. Validator passes $C_1$ and overwrites canonical injury back to `strength = 20` without any new evidence.
- **Empirical Evidence:**
  ```text
  Turn 1: strength=20 -> Turn 2: strength=12 -> Turn 3 Replay: strength=20, StateVersion=4
  ```

---

### 2.2. [PROBE-C1] PLAYER Source OVERWRITE_CHARACTER Arbitrary Max-Stat Mutation
- **Vulnerability Classification:** ACL Privilege Escalation & Unconstrained Direct Mutation
- **Location:** `src/engine/validator.ts` (`SOURCE_ACTION_ACL['PLAYER']`, `OVERWRITE_CHARACTER` validation block)
- **Mechanism:**
  `SOURCE_ACTION_ACL` authorizes source `'PLAYER'` to execute `OVERWRITE_CHARACTER`. Inside `validate()`, the handler for `OVERWRITE_CHARACTER` checks that stat keys are valid and values are in $[1, 30]$, but **fails to restrict `OVERWRITE_CHARACTER` to the initial character generation turn ($turn=1, v=1$)** or require dice rolls / point-buy constraints during gameplay.
- **Exploit Path:**
  Any player submission can unilaterally dispatch an `OVERWRITE_CHARACTER` proposal with all stats set to 30. The engine accepts and commits this without checking verified claims, dice results, or creation stage locks.
- **Empirical Evidence:**
  ```text
  Committed character stats: {"strength":30,"agility":30,"constitution":30,"intelligence":30,"wisdom":30,"charisma":30}
  ```

---

### 2.3. [PROBE-C2] Root 2 — LLM UPDATE_CHARACTER_STATS Synthetic Grounding via Active Seed ID
- **Vulnerability Classification:** Synthetic Authority Injection / Grounding Semantic Decoupling
- **Location:** `src/engine/proposalParser.ts` (lines 515-523), `src/engine/validator.ts` (lines 1060-1110)
- **Mechanism:**
  `proposalParser.ts` automatically extracts any active seed ID from `currentSnapshot.worldInfo.seeds` and injects it as `verifiedEventId` into `UPDATE_CHARACTER_STATS`. `EngineValidator.validate` considers an action valid if `verifiedEventId` matches an existing seed ID in `currentState.worldInfo.seeds`, without verifying that the seed content actually described or authorized a stat change.
- **Exploit Path:**
  LLM generates an arbitrary stat increase (`strength +8`). The parser injects `seed-ancient-scroll` as `verifiedEventId`. The Validator sees the seed exists and commits `strength: 10 -> 18`.
- **Empirical Evidence:**
  ```text
  Initial strength: 10 -> Committed strength: 18, Action verifiedEventId: seed-ancient-scroll
  ```

---

## 3. Defense Verification: Blocked Vectors

The following vectors were authoritatively verified as **BLOCKED** by the current engine architecture:
- **Entity Mismatch (A1):** Validator verifies that the target of a `VerifiedClaim` (`npc-bob`) strictly matches the entity being mutated (`protagonist`).
- **Attribute Mismatch (A2):** Validator verifies that the claimed attribute (`agility`) strictly matches the mutated field (`strength`).
- **NPC Name Claim Coupling (B1):** Renaming an NPC requires a dedicated claim targeting field `'name'`.
- **Genesis Source Post-Genesis (C3):** Source `'GENESIS'` is strictly rejected if `stateVersion !== 1` or `turn !== 1` or `lastCommittedEventId !== null`.
- **Hydration Inconsistency (D1):** `SovereignEngine.hydrate()` rejects snapshots whose turn or version is logically behind the latest historical record.
- **Idempotency Collision (D2):** Replaying a proposal with a previously processed `requestId` is rejected with `[IDEMPOTENCY_VIOLATION]`.
- **Timestamp Regression (E1):** Proposals with `timestamp <= lastCommittedAt` are rejected with `[TIMESTAMP_REGRESSION_CONFLICT]`.
- **Immutability Protection (F1, F2):** `getSnapshot()` and `getHistory()` return deeply frozen objects (`Object.freeze`); mutations throw `TypeError` in strict mode.
- **Intra-Proposal Transitive Dependencies (G1):** Proposing an `UPDATE_NPC` on an entity created in the same proposal fails provenance validation against `currentState`.

---

## 4. Red Team Conclusion & Recommended Hardening

1. **Claim Invalidation Lifecycle:**
   `VerifiedClaim` must include `originProposalId`, `issuedTurn`, `stateVersion`, and be registered in an `executedClaims: Set<string>` on commit to prevent multi-turn replay.
2. **PLAYER Source ACL Restriction:**
   `OVERWRITE_CHARACTER` must be restricted to creation phase ($turn=1, v=1$) or require engine-internal capability token.
3. **Eliminate Synthetic Grounding (Root 2 Fix):**
   Remove automatic seed ID injection in `proposalParser.ts` and require explicit verified claims or dice results for all character stat mutations.

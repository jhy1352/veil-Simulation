# VEIL FAIL-03 Runner Finding Inventory

**Audited Runner Target:** `scripts/adversarial_runtime_break_runner.ts` (1,171 lines, EOF verified)  
**Execution Environment:** Node.js v22.23.2, TypeScript 5.8.2, Linux 4.19.0-gvisor x86_64  
**Audit Scope:** Complete examination of all 16 vectors (VEC-01 ~ VEC-16) defined and executed in the runner.

---

## 1. Executive Vector Table

| Vector ID | Title / Threat Classification | Production Source Target | Symbol / Function | Runner Line Range | Triggering Code / Payload | Observed Status in Current Codebase | Sovereign Engine Connection |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **VEC-01** | Causal Relevance 2-Char Token Substring Injection | `src/engine/validator.ts` | `EngineValidator.validate` | L97–173 | Proposal with `ADD` item `'신살검 북쪽'` matching seed `'북쪽 산맥의 고룡 수색'` | `DEFENSE_HELD` | Connected to Validator Gate; Defense held (Rejected) |
| **VEC-02** | Permanent Physical Defect Negation via Substring | `src/engine/validator.ts`, `src/engine/actionApplier.ts` | `applyOverwriteCharacter` | L176–239 | `OVERWRITE_CHARACTER` action with `'Not Blind (Completely Cured)'` | `DEFENSE_HELD` | Connected to Character Immutability Gate; Defense held |
| **VEC-03** | Information Boundary Escalation via Field Omission | `src/engine/mutationBoundary.ts`, `src/engine/state.ts` | `validateLLM2MutationBoundary` | L242–317 | Candidate with `visibility: 'PRIVATE'`, final omitting visibility | `DEFENSE_HELD` | Connected to VEIL Phase 2 Boundary; Defense held |
| **VEC-04** | Fail-Closed Narrative Code Block Leakage to Client Parser | `server.ts`, `src/engine/proposalParser.ts` | `parseGMResponseAndProposal` | L320–387 | Raw LLM #2 text with invalid candidate ID + JSON code block | `DEFENSE_HELD` | Connected to Client-Server Pipeline; Defense held |
| **VEC-05** | Server-Side Non-CSPRNG Pseudorandom Generation in Sync Code | `server.ts` L46–54 | `generate6DigitSyncCode` | L390–417 | `Math.floor(Math.random() * chars.length)` in 6-digit sync code | `BREAK_CONFIRMED` | **NO CONNECTION** to Engine/Canonical State/Dice |
| **VEC-06** | Legacy Test Harness Invalid Test Setup Audit | `scripts/adversarial_forensic_suite.ts` | CASE-02 to CASE-05 | L420–444 | Harness audit of past test setup flaws | `HARNESS_FLAW_EXPOSED` | Test Harness Metrology Audit only |
| **VEC-07** | Prototype Pollution Injection via Payload Draft | `src/engine/state.ts`, `src/utils/factory.ts` | `deepClone` / `submitProposal` | L447–513 | `{"__proto__": {"pollutedKey": "..."}}` in action payload | `DEFENSE_HELD` | Connected to State Commit Draft; Defense held |
| **VEC-08** | Unauthorized Privileged Source Forgery (SYSTEM) | `src/engine/validator.ts`, `src/engine/internalCapability.ts` | `EngineValidator.validate` | L516–576 | Direct `source: 'SYSTEM'` proposal without private WeakSet token | `DEFENSE_HELD` | Connected to Provenance & ACL Gate; Defense held |
| **VEC-09** | Authorized Internal Dispatch via Private WeakSet | `src/engine/internalCapability.ts`, `src/engine/state.ts` | `dispatchEngineInternalProposal` | L579–623 | Legitimate internal capability dispatch | `DEFENSE_HELD` | Connected to Authorized Capability Path; Succeeded |
| **VEC-10** | Genesis Concurrent Submission Race Collision | `src/engine/state.ts` | `SovereignEngine.submitProposal` | L626–685 | 10 concurrent async proposals expecting version 1 | `DEFENSE_HELD` | Connected to Atomic Version Gate; Exactly 1 committed |
| **VEC-11** | Duplicate Request ID Proposal Replay Attack | `src/engine/validator.ts`, `src/engine/state.ts` | `executedRequestIds` registry | L688–757 | Replay identical `requestId` on subsequent turn | `DEFENSE_HELD` | Connected to Idempotency Registry; Defense held |
| **VEC-12** | Duplicate Event ID Historical Collision Attack | `src/engine/validator.ts`, `src/engine/state.ts` | `recordedEventIds` registry | L760–827 | Submit different proposal with duplicate `eventId` | `DEFENSE_HELD` | Connected to Event Collision Registry; Defense held |
| **VEC-13** | Multi-Action Atomic Rollback on Draft Exception | `src/engine/state.ts` | Step 2 Draft isolation in `submitProposal` | L830–907 | 2 actions: Action 1 succeeds, Action 2 throws error | `DEFENSE_HELD` | Connected to Atomic Transaction Gate; Zero partial mutation |
| **VEC-14** | DEAD NPC Resurrection / Status Mutation Attempt | `src/engine/validator.ts` | `SET_NPC_STATUS` validator | L910–974 | `SET_NPC_STATUS` to `ALIVE` for NPC with status `DEAD` | `DEFENSE_HELD` | Connected to Entity Immutability Gate; Defense held |
| **VEC-15** | Canonical Snapshot Deep-Freeze Immutability | `src/engine/state.ts` | `deepFreeze` on `getSnapshot()` | L977–1022 | Direct nested assignment to snapshot object | `DEFENSE_HELD` | Connected to In-Memory Snapshot Protection; Defense held |
| **VEC-16** | Cloud Save / History Hydration Integrity Defense | `src/engine/state.ts` | `SovereignEngine.hydrate` | L1025–1092 | Tampered history with chronologically regressed turns/timestamps | `DEFENSE_HELD` | Connected to Persistence Hydration Boundary; Defense held |

---

## 2. Summary of Findings

1. **Active Break Detected by Runner:** Exactly 1 vector (**VEC-05**).
2. **Harness Flaw Detected:** Exactly 1 vector (**VEC-06**).
3. **Immutability & Defense Validated:** 14 vectors (**VEC-01 ~ VEC-04, VEC-07 ~ VEC-16**).

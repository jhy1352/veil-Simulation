# Sovereign Engine Boundary Connectivity & Proof Matrix

## 1. Engine Security Boundary Verification Checklist

For each vector tested in `scripts/adversarial_runtime_break_runner.ts`, we trace the call and data flow across all Engine trust boundaries:

| Vector ID | Boundary Tested | Entry Point / Call Path | Reaches Engine Validator? | Reaches State Commit? | State Mutated? | Resulting Impact on Sovereign Reality |
|:---|:---|:---|:---:|:---:|:---:|:---|
| **VEC-01** | Causal Token Semantic Relevance Gate | `submitProposal` -> `EngineValidator.validate` -> `verifyAcquisitionCausality` | YES | NO (Rejected) | NO (0 bytes) | Attack neutralised; weapon pickup rejected |
| **VEC-02** | Permanent Defect Immutability Gate | `submitProposal` -> `EngineValidator.validate` -> `applyOverwriteCharacter` | YES | NO (Rejected) | NO (0 bytes) | Attack neutralised; character blindness preserved |
| **VEC-03** | Mutation Boundary Information Leak Gate | `validateLLM2MutationBoundary` -> `submitProposal` | YES | YES (Sanitized) | NO (Sanitized) | Private visibility preserved without escalation |
| **VEC-04** | Client GM Parser Markdown Injection Gate | `server.ts` clean -> `parseGMResponseAndProposal` | YES | NO (Cleaned) | NO (0 bytes) | Injected markdown JSON ignored; no proposal created |
| **VEC-05** | Web Server Room Code RNG Gate | HTTP POST `/api/cloud-save` -> `generate6DigitSyncCode` | NO | NO | NO (0 bytes) | Auxiliary Web-layer room code generation only |
| **VEC-06** | Test Harness Metrology Gate | `scripts/adversarial_forensic_suite.ts` | N/A | N/A | N/A | Exposes test harness setup flaws; no prod break |
| **VEC-07** | Prototype Pollution Mitigation Gate | `submitProposal` -> `deepClone` / `safeAssign` | YES | YES (Clean) | NO (Clean) | Prototype pollution neutralized; engine clean |
| **VEC-08** | Privileged Source Token Verification Gate | `submitProposal` -> `EngineValidator.validate` (source ACL) | YES | NO (Rejected) | NO (0 bytes) | Forged SYSTEM proposal rejected with `[SECURITY_FORGERY]` |
| **VEC-09** | Authorized Private WeakSet Capability Gate | `dispatchEngineInternalProposal` (with private token) | YES | YES (Authorized) | YES (Authorized) | Legitimate capability commit succeeded; version advanced |
| **VEC-10** | Concurrency Version Race Gate | 10 async `submitProposal` calls (all version 1) | YES | 1 of 10 | Exactly 1 | 1 succeeded, 9 rejected with `[STALE_STATE_CONFLICT]` |
| **VEC-11** | Idempotency Duplicate Request ID Gate | `submitProposal` -> `executedRequestIds.has(requestId)` | YES | NO (Rejected) | NO (0 bytes) | Replay proposal rejected with `[IDEMPOTENCY_VIOLATION]` |
| **VEC-12** | Event Collision Duplicate Event ID Gate | `submitProposal` -> `recordedEventIds.has(eventId)` | YES | NO (Rejected) | NO (0 bytes) | Event collision rejected with `[EVENT_CONFLICT]` |
| **VEC-13** | Transactional All-or-Nothing Atomic Rollback | `submitProposal` Step 2 Draft execution error trap | YES | NO (Rollback) | NO (0 bytes) | Partial action rolled back; state perfectly restored |
| **VEC-14** | Entity Immutability (DEAD NPC) Gate | `submitProposal` -> `EngineValidator.validate` (`SET_NPC_STATUS`) | YES | NO (Rejected) | NO (0 bytes) | Dead NPC resurrection rejected with `[DEAD_NPC_STATUS_PROTECTION]` |
| **VEC-15** | In-Memory Snapshot Deep-Freeze Gate | `engine.getSnapshot()` -> `Object.freeze` recursive | YES | N/A | NO (0 bytes) | External mutation attempts fail; snapshot immutable |
| **VEC-16** | Cloud Hydration History Temporal Integrity Gate | `SovereignEngine.hydrate(payload)` | YES | NO (Rejected) | NO (0 bytes) | Regressed history rejected with `[HYDRATION_INTEGRITY_VIOLATION]` |

---

## 2. Definitive Proof of Zero Engine Impact

1. **Authority & Provenance:** No unauthorized actor can bypass `EngineValidator` or forge privileged sources.
2. **Canonical State Integrity:** No unvalidated action ever commits; all transactions are atomic and protected by monotonic `stateVersion`.
3. **Gameplay RNG & Dice:** Gameplay randomness is governed within the client/engine architecture; `server.ts:generate6DigitSyncCode` is purely an ephemeral room lookup key for HTTP save/load.
4. **Historical Continuity:** Dead entities cannot be resurrected, defects cannot be cured via substring tricks, and regressed histories are rejected upon hydration.

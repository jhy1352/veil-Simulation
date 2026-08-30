# VEC-06 ~ VEC-16 Vector Details & Defense Verifications

## VEC-06: Legacy Test Harness Invalid Test Setup Audit
- **Source Target:** `scripts/adversarial_forensic_suite.ts` (CASE-02 ~ CASE-05)
- **Classification:** `HARNESS_FLAW_EXPOSED`
- **Forensic Detail:** Legacy test cases attempted to use `PLAYER` or `LLM` sources to submit `SET_WORLD_METADATA`, which was strictly blocked by `EngineValidator` source ACL rules on Turn 1, leading to false assumption failures in legacy test harness assertions.

---

## VEC-07: Prototype Pollution Injection via Payload Draft Mutation
- **Source File:** `src/engine/state.ts` & `src/utils/factory.ts`
- **Trigger:** JSON payload containing `{"__proto__": {"pollutedKey": "CRITICAL_POLLUTION_INJECTED"}}` submitted via `ADD_RUMOR`.
- **Verdict:** `Object.prototype.pollutedKey` remained `undefined`. Safe deep clone neutralized prototype pollution.
- **Status:** `DEFENSE_HELD`.

---

## VEC-08: Unauthorized Privileged Source Forgery (SYSTEM / ENGINE_INTERNAL)
- **Source File:** `src/engine/validator.ts` & `src/engine/internalCapability.ts`
- **Trigger:** Attacker marks `proposal.source = 'SYSTEM'` without possessing private engine capability token.
- **Verdict:** `EngineValidator.validate` rejected proposal with `[SECURITY_FORGERY]`. Commit was not reached.
- **Status:** `DEFENSE_HELD`.

---

## VEC-09: Authorized Internal Dispatch via Private WeakSet Capability
- **Source File:** `src/engine/internalCapability.ts` & `src/engine/state.ts`
- **Trigger:** Legitimate internal system invocation via `dispatchEngineInternalProposal(engine, ...)`.
- **Verdict:** Proposal validated with private token in WeakSet, committed successfully, advancing `stateVersion` from 1 to 2.
- **Status:** `DEFENSE_HELD`.

---

## VEC-10: Genesis Concurrent Submission Race Test (10 Simultaneous Proposals)
- **Source File:** `src/engine/state.ts`
- **Trigger:** 10 asynchronous concurrent proposals expecting `stateVersion: 1` hitting the same engine instance.
- **Verdict:** Exactly 1 proposal succeeded (`stateVersion` advanced to 2), all 9 remaining proposals were rejected with `[STALE_STATE_CONFLICT]`. Zero race corruption.
- **Status:** `DEFENSE_HELD`.

---

## VEC-11: Duplicate Request ID Proposal Replay Attack
- **Source File:** `src/engine/validator.ts` & `src/engine/state.ts`
- **Trigger:** Resubmitting proposal with duplicate `requestId: 'req-shared-id-target'`.
- **Verdict:** `EngineValidator` detected existing ID in `executedRequestIds` and rejected with `[IDEMPOTENCY_VIOLATION]`.
- **Status:** `DEFENSE_HELD`.

---

## VEC-12: Duplicate Event ID Historical Registry Collision Attack
- **Source File:** `src/engine/validator.ts` & `src/engine/state.ts`
- **Trigger:** Submitting new proposal with duplicate `eventId: 'evt-shared-target'`.
- **Verdict:** `EngineValidator` detected collision in `recordedEventIds` and rejected with `[EVENT_CONFLICT]`.
- **Status:** `DEFENSE_HELD`.

---

## VEC-13: Multi-Action Atomic Rollback on Runtime Draft Exception
- **Source File:** `src/engine/state.ts`
- **Trigger:** Proposal with Action 1 (valid) and Action 2 (throws dynamic runtime exception in Step 2 Draft).
- **Verdict:** `submitProposal` caught error, triggered atomic rollback, commit was not reached, and state before vs after was 100% identical.
- **Status:** `DEFENSE_HELD`.

---

## VEC-14: DEAD NPC Resurrection / Status Mutation Attempt
- **Source File:** `src/engine/validator.ts`
- **Trigger:** `SET_NPC_STATUS` attempting to set status `ALIVE` on deceased NPC (`status: 'DEAD'`).
- **Verdict:** `EngineValidator` rejected proposal with `[DEAD_NPC_STATUS_PROTECTION]`. NPC remained `DEAD`.
- **Status:** `DEFENSE_HELD`.

---

## VEC-15: Canonical Snapshot Deep-Freeze Immutability
- **Source File:** `src/engine/state.ts`
- **Trigger:** Direct mutation of nested properties on `engine.getSnapshot()` (`worldName`, `stats.strength`).
- **Verdict:** `deepFreeze` prevented mutation; fresh snapshot verified zero internal corruption.
- **Status:** `DEFENSE_HELD`.

---

## VEC-16: Cloud Persistence & History Hydration Integrity Verification
- **Source File:** `src/engine/state.ts` (`SovereignEngine.hydrate`)
- **Trigger:** Hydrating engine with history exhibiting turn/timestamp/version regression.
- **Verdict:** `SovereignEngine.hydrate` threw `[HYDRATION_INTEGRITY_VIOLATION]`, rejecting corrupted data.
- **Status:** `DEFENSE_HELD`.

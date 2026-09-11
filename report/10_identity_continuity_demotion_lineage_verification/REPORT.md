# VEIL Engine Forensic Verification Report: Identity Continuity, Canon Demotion & Lineage Tracking

- **Category**: 10_identity_continuity_demotion_lineage_verification
- **Date**: 2026-09-03
- **Engine Version**: TRPG 3.1 VEIL Sovereign Runtime
- **Verification Level**: RED TEAM Exhaustive Invariant & Forensics Verification

---

## 1. Executive Summary & Objective

In accordance with TRPG 3.1 Constitution:
- **Article 1 & Article 2 (Absolute Principles)**: Canonical State is the sole authority on current world reality. Historical Record preserves immutable past reality. LLM, Player inputs, and Passport projections possess ZERO world-mutating authority.
- **Article 3 (World Sovereignty)** & **Article 4 (Authority & Data Distinction)**: State transitions must proceed strictly through verified engine gates (`SovereignEngine.submitProposal`).
- **Article 5 (Authority Hierarchy)**: `CanonicalState` > `ImmutableHistoricalRecord` > `IdentityResolver` > `NovelHistory` > `Passport Projection` > `LLM Claim`.
- **VEIL Identity Continuity Directive**:
  1. **Authoritative Promotion**: Novel → Canon promotion strictly requires:
     - Real novel entity observation.
     - Authoritative Canon identity determination via `IdentityResolver`.
     - Engine verification as an active actor or primary cause in a committed Canonical mutation (actions or authoritative events).
     - Verified causal link (`isAuthoritativeEventCausallyRelated`).
  2. **Authoritative Demotion**: Canon → Novel demotion must operate via an independent pure decision gate (`evaluateCanonDemotion`):
     - **Fail-Closed**: Inactivity, narrative silence, or canonical inactive states (`DEAD`, `CONSUMED`, `RESOLVED`, `DORMANT`, `ARCHIVED`) are strictly forbidden from triggering demotion.
     - **LLM/Fake Claim Rejection**: Rejection of unverified LLM claims, fake event IDs, and unrelated authoritative events.
     - **Causal Invalidation**: Only committed authoritative events that causally invalidate identity can trigger demotion.
  3. **Forensic Lineage Preservation**: Historical records are never deleted. Domain transitions are tracked in an append-only `transitionHistory` array with monotonically increasing version numbers, predecessor references, and timestamped turns.
  4. **Projection Certification**: Demoted entities (`DEMOTED_NOVEL`) are projected by `projectPassports` into the `NOVEL` domain with status `ACTIVE`, linking to their predecessor canonical ID and incremented `passportVersion`.

---

## 2. Architecture & Implementation

### 2.1 Authoritative Demotion Decision Gate (`evaluateCanonDemotion`)

Located in `/src/engine/index/novelHistory.ts`:

```typescript
export function evaluateCanonDemotion(
  query: CanonDemotionQuery,
  canonicalState: CanonicalState,
  history: readonly ImmutableHistoricalRecord[]
): CanonDemotionDecision {
  // 1. Target existence verification in canonical state
  // 2. Reject inactive canonical states (DEAD, CONSUMED, etc.) as demotion triggers
  // 3. Reject pure inactivity or absence of narrative mentions
  // 4. Reject pure LLM claims without committed engine evidence
  // 5. Authoritative event lookup and causal relationship verification via isAuthoritativeEventCausallyRelated()
  // 6. Return fail-closed decision with explicit diagnostic reason code
}
```

### 2.2 Lineage Preservation & Transition History (`demoteCanonRecordToNovel`)

```typescript
export function demoteCanonRecordToNovel(
  existingRecord: NovelHistoryRecord | undefined,
  query: CanonDemotionQuery,
  turn: number,
  reason: string
): NovelHistoryRecord {
  // 1. Increment version monotonically
  // 2. Append domain transition record to transitionHistory:
  //    { fromDomain: 'CANON', toDomain: 'NOVEL', version: nextVersion, turn, predecessorId, reason }
  // 3. Set lifecycle to 'DEMOTED_NOVEL'
  // 4. Preserve demotedFromCanonicalId and demotedAtTurn
}
```

### 2.3 Passport Projection for Demoted Entities (`projectPassports`)

Located in `/src/engine/index/passport.ts`:
- Demoted records (`novel.lifecycle === 'DEMOTED_NOVEL'`) are mapped to `EntityDescriptor` with domain `NOVEL`.
- In `isNovelEntityActive()`, `DEMOTED_NOVEL` records evaluate to `true` (status `ACTIVE`), allowing continuous interaction within the novel domain without corrupting canonical state.
- `predecessorPassportId` is populated with `novel.demotedFromCanonicalId`.
- `passportVersion` reflects the entity's lineage version.

---

## 3. Test Suite Matrix & Verifications

### 3.1 Lifecycle Test Suite (`novelLifecycleTest.ts`)

| Case | Scenario | Expected Outcome | Result |
|---|---|---|---|
| **Case 16** | Canon status `DEAD`, `CONSUMED`, `RESOLVED`, or pure inactivity | Rejected (`CANON_INACTIVE_STATUS_NOT_DEMOTION`, `INACTIVITY_ONLY_NOT_DEMOTION`) | **PASSED** |
| **Case 17** | Pure LLM claim / unverified or fake event ID | Rejected (`LLM_CLAIM_REJECTED`, `FAKE_OR_UNVERIFIED_EVENT`) | **PASSED** |
| **Case 18** | Real committed authoritative event, but unrelated to target | Rejected (`UNRELATED_EVENT`) | **PASSED** |
| **Case 19** | Authoritative causal invalidation committed on engine | Promoted to `DEMOTED_NOVEL`, lineage version = 3, transition history recorded | **PASSED** |
| **Case 20** | Genesis Canon entity demotion | Successfully demoted, transition history generated, lineage version = 2 | **PASSED** |

### 3.2 Passport Projection Test Suite (`passportTest.ts`)

| Suite | Scenario | Expected Outcome | Result |
|---|---|---|---|
| **Suite 8** | `DEMOTED_NOVEL` entity passport projection | Domain `NOVEL`, status `ACTIVE`, `passportVersion` = 3, `predecessorPassportId` = previous canon ID, stamp matched to committed event | **PASSED** |

---

## 4. Verification Summary

- **`test:novel-lifecycle`**: 107 test assertions passed, 0 failed.
- **`test:passport`**: 92 test assertions passed, 0 failed.
- **`tsc --noEmit` (Linter)**: Clean pass, 0 errors.
- **`compile_applet`**: Production build succeeded cleanly.
- **Forensic Truth**: No unverified claims or fake states were produced. All mutations adhere strictly to the Sovereign Engine Truth Boundary and Constitution.

# VEIL Engine Forensic Verification Report: Identity Invalidation to Canon Demotion Pipeline

- **Category**: 19_identity_invalidation_canon_demotion_pipeline
- **Date**: 2026-09-05
- **Engine Version**: TRPG 3.1 VEIL Sovereign Runtime
- **Verification Level**: RED TEAM Exhaustive Invariant & Forensics Verification

---

## 1. Executive Summary & Constitutional Authority

In accordance with the TRPG 3.1 Constitution:
- **Article 1 & Article 2 (Absolute Principles)**: The world reality is governed solely by the validated Canonical State. LLM outputs and Player claims are NOT canonical truth.
- **Article 5 (Authority Hierarchy)**:
  `World Rules` > `Validated Canonical State` > `Validated State Transition` > `Validated Dice Result` > `Validated Intent / Claim` > `Validated External Evidence` > `LLM Candidate / Inference` > `Player Claim`.
- **Article 6 (Bidirectional Truth Boundary)**: `LLM -> ENGINE -> WORLD`. No input may directly alter World State.
- **Article 8 (LLM Output Authority Restriction)**: LLM output cannot finalize Canonical State, Events, State Transitions, or Demotions.
- **Article 12 & Article 13 (Parse != Validate != Commit)**: Parsed candidate metadata is untrusted until committed by the Sovereign Engine.

### Core Architecture Implementation
1. **Separation of Untrusted Declaration**: `IdentityInvalidationDeclaration` is held on `CandidatePacket` and passed to `StateTransitionProposal` as untrusted metadata. It is strictly forbidden from directly becoming a canonical `TransitionAction` or modifying `VerifiedClaim`.
2. **Commit First Invariant**: `observeCandidateNovelHistory()` ignores invalidation declarations if the proposal was not committed to the Sovereign Engine (`lastCommittedEventId` or in `historicalRecords`).
3. **Authoritative Event Resolution**: `evaluateCanonDemotion()` eliminates untrusted fallbacks (e.g. `evidenceIds[0]`) and resolves strictly through `verifiedInvalidationEventId` or `declaredEventId` against authoritative committed events in `ImmutableHistoricalRecord[]`.
4. **Deterministic Semantic Verification**: `isEventDeterministicIdentityInvalidation()` analyzes the committed event's description and semantic markers to ensure that mere non-invalidation events (such as location movement, normal death, or narrative presence) never trigger identity invalidation.
5. **Fail-Closed Demotion**: If an invalidation declaration references an uncommitted or fabricated event ID, an unrelated event, or a non-invalidation event, `evaluateCanonDemotion()` fails closed and issues explicit diagnostic reasons (`FAKE_OR_UNVERIFIED_EVENT`, `NON_IDENTITY_INVALIDATION_EVENT`, `UNRELATED_EVENT`).
6. **Preservation of Lineage**: On successful authoritative invalidation, `demoteCanonRecordToNovel()` preserves the entity's lineage history, increments the entity version, logs domain transitions from `CANON` to `NOVEL`, and assigns `DEMOTED_NOVEL`.

---

## 2. Architecture & Implementation Specifics

### 2.1 Untrusted Metadata Ingress (`src/engine/types.ts`)
```typescript
export interface IdentityInvalidationDeclaration {
  readonly targetCanonicalId: string;
  readonly entityType: 'NPC' | 'ITEM' | 'FACTION' | 'SEED';
  readonly targetName?: string;
  readonly declaredEventId?: string;
  readonly reason?: string;
}

export interface StateTransitionProposal {
  // ...
  readonly identityInvalidationDeclarations?: readonly IdentityInvalidationDeclaration[];
}
```

### 2.2 Semantic Invalidation Verification (`src/engine/index/novelHistory.ts`)
```typescript
export function isEventDeterministicIdentityInvalidation(
  eventRecord: ImmutableHistoricalRecord | HistoricalRecord,
  targetCanonicalId: string,
  targetName?: string
): boolean {
  // Verifies entity involvement and matching keywords (신원 사기, 사칭, 가짜, 위장, 정체 탄로, 사기극 등)
  // Rejects mere movement, injury, death, or unrelated actions.
}
```

### 2.3 Strict Authoritative Demotion Evaluation (`src/engine/index/novelHistory.ts`)
```typescript
export function evaluateCanonDemotion(
  query: CanonDemotionQuery,
  canonicalState: CanonicalState,
  history: readonly ImmutableHistoricalRecord[]
): CanonDemotionDecision {
  // 1. Target existence in canonical state
  // 2. Reject inactive canonical states (DEAD, CONSUMED, etc.)
  // 3. Reject pure LLM claims without committed engine evidence
  // 4. Strict event lookup: only from verifiedInvalidationEventId
  // 5. Verify event commitment in history
  // 6. Verify deterministic identity invalidation semantic markers
  // 7. Verify causal specificity to target
}
```

### 2.4 Candidate Observation Gate (`src/engine/index/novelHistory.ts`)
```typescript
export function observeCandidateNovelHistory(
  existingRecords: readonly NovelHistoryRecord[],
  candidate: CandidatePacket,
  proposal: StateTransitionProposal,
  canonicalState: CanonicalState,
  storyTurnCount: number,
  historicalRecords: readonly ImmutableHistoricalRecord[]
): CandidateObservationResult {
  // Enforces Sovereign Commit verification:
  // Fails closed if proposal is uncommitted.
  // Demotes canonical entity only upon authoritative invalidation confirmation.
}
```

---

## 3. Test Verification Matrix (`novelLifecycleTest.ts` Case 21)

| Sub-Case | Description | Expected Behavior | Result |
|---|---|---|---|
| **Case 21.1** | Fraud event committed to Sovereign Engine + LLM declaration | Declaration parsed untrusted, proposal committed, demoted to `DEMOTED_NOVEL`, duplicate demotion prevented | **PASSED** |
| **Case 21.2** | Movement event committed to Engine + LLM declaration | Rejection via `NON_IDENTITY_INVALIDATION_EVENT`, 0 demotions | **PASSED** |
| **Case 21.3** | Uncommitted proposal + declaration of fake event | Proposal rejected/uncommitted, fail-closed via `FAKE_OR_UNVERIFIED_EVENT`, 0 demotions | **PASSED** |
| **Case 21.4** | Pure LLM claim without committed event | Demotion rejected via `LLM_CLAIM_REJECTED`, 0 demotions | **PASSED** |

---

## 4. Verification Summary

All 126 test cases in `novelLifecycleTest.ts` along with all comprehensive engine test suites (engine, language, candidate-gate, identity-continuity, passport, provenance, hydration) pass with 100% success. System invariants and constitutional separation of powers remain strictly preserved.

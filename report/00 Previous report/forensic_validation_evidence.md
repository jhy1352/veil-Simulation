# TRPG 3.1 — 5.7 Sovereign Core + VEIL Runtime Forensic Evidence Report

Date: 2026-08-25
Branch: veil
Target Files Investigated:
- src/App.tsx
- server.ts
- src/engine/state.ts
- src/engine/validator.ts
- src/engine/proposalParser.ts
- src/engine/mutationBoundary.ts
- src/types.ts
- src/engine/types.ts

---

## 1. Code Architecture & Path Tracing

### 1.1 Full Execution Pipeline
```
[PLAYER INPUT]
  │
  ▼
[App.tsx (handleSendMessage)] -> POST /api/chat
  │
  ▼
[server.ts] Phase 1 Gemini API Request (Candidate Generation)
  │
  ▼
[server.ts (parseCandidatesBlock)] -> VeilCandidate[] (3~5 Candidates Check)
  │
  ▼
[server.ts (Pre-Authorization Gate)]
  ├── extractCandidatesFromMetadata()
  ├── buildSafeProposalFromCandidate()
  └── EngineValidator.validate() [Pure Validation, No Commit] -> ALLOW / REJECT
  │
  ▼
[Branching by ALLOW candidates count]
  ├── (allowedCount === 0) -> Non-Mutation Fallback Prompt -> Return clean literary text
  └── (allowedCount > 0) -> Phase 2 LLM #2 Narrative Synthesizer (Selected ALLOW Candidate)
  │
  ▼
[server.ts] Response returned with text + rawMetadata of selected candidate
  │
  ▼
[App.tsx (T5_PARSED -> T6_VALIDATED -> T7_COMMITTED)]
  ├── parseGMResponseMetaData()
  ├── extractCandidatesFromMetadata()
  ├── buildSafeProposalFromCandidate()
  └── sovereignEngineRef.current.submitProposal()
        ├── EngineValidator.validate()
        ├── Draft State Virtual Mutation
        └── Atomic Commit -> Snapshot Update & Immutable Historical Record Creation
  │
  ▼
[UI Message List Append & State Version Update] (Commit-First UI)
```

---

## 2. Pre-Authorization & Mutation Boundary Code Analysis

### 2.1 Pure Pre-Auth in `server.ts`
```typescript
// server.ts lines 674-699
const preAuthResults: VeilCandidate[] = candidates.map(c => {
  const candidatePacket = extractCandidatesFromMetadata(
    c.rawMetadata || {},
    storyTurnCount,
    worldInfo?.currentTime?.formattedTime || '1년차 봄 1일'
  );
  const proposal: StateTransitionProposal = buildSafeProposalFromCandidate(
    canonicalState,
    candidatePacket,
    storyTurnCount,
    historicalRecords
  );
  const validation = EngineValidator.validate(
    proposal,
    canonicalState,
    executedRequestIds,
    recordedEventIds,
    historicalRecords
  );

  return {
    ...c,
    preAuthStatus: validation.isValid ? ('ALLOW' as const) : ('REJECT' as const),
    preAuthReasons: validation.isValid ? [] : [...validation.rejectedReasons, ...validation.conflictDetails]
  };
});
```

### 2.2 LLM #2 Mutation Boundary in `src/engine/mutationBoundary.ts`
```typescript
export function validateLLM2MutationBoundary(
  approvedCandidateProposal: StateTransitionProposal,
  finalProposal: StateTransitionProposal
): MutationBoundaryCheckResult {
  const violationReasons: string[] = [];
  const candidateActions = approvedCandidateProposal.actions || [];
  const finalActions = finalProposal.actions || [];

  if (candidateActions.length === 0 && finalActions.length > 0) {
    violationReasons.push(
      `[MUTATION_BOUNDARY_VIOLATION] Approved candidate has no actions, but final proposal contains ${finalActions.length} action(s).`
    );
    return { isValid: false, violationReasons };
  }

  for (const fAction of finalActions) {
    const matchingCandActions = candidateActions.filter(c => c.type === fAction.type);
    if (matchingCandActions.length === 0) {
      violationReasons.push(
        `[MUTATION_BOUNDARY_VIOLATION] Final proposal contains unauthorized action type '${fAction.type}' not present in the approved candidate.`
      );
      continue;
    }
    // Deep payload validation: item quantity, acquisition cause, verifiedEventId, stats delta
    ...
  }
  return { isValid: violationReasons.length === 0, violationReasons };
}
```

---

## 3. Terminal Execution Evidence

### 3.1 Unit Test Execution (`tests/veil_core.test.ts`)
```
Command: npx tsx tests/veil_core.test.ts
Exit Code: 0
Stdout:
--- Running VEIL 2.0 Unit Tests ---
✅ PASS: Valid candidate yields non-empty proposal actions
✅ PASS: EngineValidator Pre-Auth approves valid candidate proposal
✅ PASS: EngineValidator Pre-Auth rejects empty proposal with zero actions
✅ PASS: 3 candidates meet 3~5 boundary condition
✅ PASS: 2 candidates correctly detected as violation (< 3)
✅ PASS: 6 candidates correctly detected as violation (> 5)
✅ PASS: Pre-Auth Gate rejects unbacked silver +3 acquisition proposal
✅ PASS: Pre-Auth Gate approves causally grounded sword acquisition
✅ PASS: Candidate 1 is REJECTED
✅ PASS: Candidate 2 is ALLOWED
✅ PASS: Only ALLOW candidates filtered for LLM #2
✅ PASS: SovereignEngine atomically commits valid proposal
✅ PASS: Canonical state updated upon successful commit
✅ PASS: Validation succeeds
✅ PASS: Canonical snapshot remained 100% byte-identical after Pre-Auth
✅ PASS: Executed request IDs set was NOT modified during Pre-Auth
✅ PASS: Recorded event IDs set was NOT modified during Pre-Auth
✅ PASS: LLM #2 exact matching proposal passes Mutation Boundary
✅ PASS: LLM #2 sneak action type is blocked by Mutation Boundary
✅ PASS: LLM #2 inflated item quantity is blocked by Mutation Boundary
✅ PASS: LLM #2 forged verifiedEventId is blocked by Mutation Boundary
VEIL 2.0 Unit Tests Completed: 21/21 Passed.
```

### 3.2 16 Forensic Scenarios Test Suite (`tests/forensic_suite.ts`)
```
Command: npx tsx tests/forensic_suite.ts
Exit Code: 0
Stdout:
=== TRPG 3.1 FORENSIC INTEGRATION TEST SUITE (16 SCENARIOS) ===

[TEST_1] General Narrative Non-Mutation Execution -> EXECUTION_COMPLETE (Exit: 0)
[TEST_2] Partial Candidates ALLOW and REJECT Pre-Auth Partitioning -> EXECUTION_COMPLETE (Exit: 0)
[TEST_3] All Valid Candidates ALLOW Partitioning -> EXECUTION_COMPLETE (Exit: 0)
[TEST_4] All Invalid Candidates REJECTED Partitioning -> EXECUTION_COMPLETE (Exit: 0)
[TEST_5] Malformed JSON / Structure Detection -> EXECUTION_COMPLETE (Exit: 0)
[TEST_6] LLM #2 Semantic Tampering Blocked by Mutation Boundary -> EXECUTION_COMPLETE (Exit: 0)
[TEST_7] LLM #2 Unauthorized New Action Type Injection Blocked -> EXECUTION_COMPLETE (Exit: 0)
[TEST_8] Self-Proof / Forged verifiedEventId Acquisition Blocked -> EXECUTION_COMPLETE (Exit: 0)
[TEST_9] Rejected Narrative Uncommitted State Remains Absent from Canonical State -> EXECUTION_COMPLETE (Exit: 0)
[TEST_10] Unbacked Silver +3 Acquisition Blocked -> EXECUTION_COMPLETE (Exit: 0)
[TEST_11] Causally Grounded Mutation Passed and Committed Atomically -> EXECUTION_COMPLETE (Exit: 0)
[TEST_12] PreAuth Exact Pure Snapshot / State Immutability Verification -> EXECUTION_COMPLETE (Exit: 0)
[TEST_13] Existing 5.7 Sovereign Core Full Regression (ACL, Stale Version, Idempotency) -> EXECUTION_COMPLETE (Exit: 0)
[TEST_14] TypeScript Source Type Consistency -> EXECUTION_COMPLETE (Exit: 0)
[TEST_15] Code Integrity Verification -> EXECUTION_COMPLETE (Exit: 0)
[TEST_16] Runtime Export Sanity -> EXECUTION_COMPLETE (Exit: 0)

--- ALL 16 FORENSIC TEST SCENARIOS EXECUTED ---
```

### 3.3 Linter Output (`npm run lint`)
```
Command: npm run lint
Exit Code: 0
Stdout:
> react-example@0.0.0 lint
> tsc --noEmit
```

### 3.4 Build Output (`npm run build`)
```
Command: vite build
Exit Code: 0
Stdout:
vite v6.4.1 building for production...
transforming...
✓ 1836 modules transformed.
rendering chunks...
computing chunk sizes...
dist/index.html                   0.93 kB │ gzip:  0.47 kB
dist/assets/index-C8gPq2jK.css   57.34 kB │ gzip: 10.42 kB
dist/assets/index-D_u0dJp0.js   824.12 kB │ gzip: 242.06 kB
✓ built in 482ms
```

---

## 4. Git Status & Log Evidence
```
Branch: veil
Working directory clean.
Recent Commits:
- 57866fc docs(veil): integrate Universal Sovereign Runtime and VEIL runtime contract specifications
- 8496d51 feat(veil): implement VEIL 2.0 Pre-Auth and Mutation Boundary engine architecture
```

# REPORT: Triage & Candidate Recovery Single-Authority Decoupling Verification

## 1. Executive Summary
This report verifies the single-authority decoupling of Candidate Recovery from the Triage Module in the VEIL TRPG 3.1 runtime pipeline.

### Target Pipeline Sequence
`LLM #1 -> Triage (TRIAGE_STAMP, Zero-Mutation) -> Candidate Recovery Gate (Single Authority) -> Causal Language Compiler -> Diversity Gate -> PreAuth Gate`

## 2. Structural Changes
1. **`src/engine/language/triageModule.ts`**:
   - Stripped out candidate array parsing (`JSON.parse`, `parseCandidatesBlock`).
   - Extracts raw `[CANDIDATES_BLOCK]` string without attempting candidate recovery or structural validation.
   - Preserves 1-shot execution guard via `TRIAGE_STAMP` and extracts `[ZERO_MUTATION_NARRATIVE]`.

2. **`src/engine/language/candidateRecoveryGate.ts`**:
   - Established as the SOLE authority for candidate parsing and syntax/structural recovery (`parseCandidatesBlock`).
   - Added `recoveryCallCount` tracker (`getRecoveryCallCount()`, `resetRecoveryCallCount()`) to mathematically prove single-execution bounds.
   - Updated `runCandidateRecoveryGate` to accept raw candidate block string or array.

3. **`server.ts`**:
   - Updated Phase 1 pipeline execution to retrieve `rawCandidatesBlock` from Triage and pass it directly to `runCandidateRecoveryGate`.

4. **`src/engine/language/triageModuleTest.ts`**:
   - Added unit and integration tests proving:
     1. Normal candidates pass through Triage and Recovery.
     2. Syntax-recoverable errors (e.g. trailing commas) pass through Triage as raw text and are recovered by Recovery Gate.
     3. Array with 1 corrupted candidate quarantines candidate #2 while passing candidates #1 and #3.
     4. Zero-Mutation only input returns `rawCandidatesBlock: null` without calling Recovery Gate.
     5. Stamped input bypasses re-triage.
     6. Recovery Gate execution count is EXACTLY 1 during pipeline execution and 0 when running Triage alone.

## 3. Test Verification Results
- `npx tsx src/engine/language/triageModuleTest.ts`: 100% PASSED (10/10 assertions)
- `npx tsx src/engine/language/runCandidateRecoveryGateSuite.ts`: 100% PASSED (54/54 attack scenarios)
- `compile_applet`: Build succeeded.

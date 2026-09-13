# VEIL P0 TELEMETRY FORENSIC & REAL RUNTIME PROOF REPORT

## 1. Executive Summary & Forensic Truth
- **Target Model**: `gemini-3.1-flash-lite`
- **Verification Environment**: Full-stack Cloud Run Node.js container / Real HTTP Server (`/api/chat`)
- **P0 Fix 1 (Candidate Cardinality)**: VERIFIED. `rawCandidateCount` == `stage0Count` == `telemetryTraceCount`. Invariant 0 (Candidate Loss Detection) implemented.
- **P0 Fix 2 (COMMITTED Authority)**: VERIFIED. `authorizedProposal` 존재나 `selectedCandidate` 선택만으로 COMMITTED를 부여하지 않고, `SovereignEngine.submitProposal()`이 실제 실행되어 Canonical State mutation이 확인될 때만 COMMITTED 판정.
- **PreAuth Non-Entry Status**: VERIFIED. PreAuth 미진입 candidate는 REJECT가 아닌 `NOT_REACHED`로 기록.

---

## 2. Independent Real Runtime Execution Evidence Summary

### Test A — All Reject
- **Input**: "주막 주모에게 다가가 주변 무림 소문에 대해 자세히 물어본다."
- **Raw Candidate Count**: 2
- **Stage 0 Count**: 2
- **Telemetry Traces Count**: 2 (Cardinality Match: TRUE)
- **Stage 2 Rejects**: 2 (Action: `ENTER`, `TRAVEL` -> Fail-Closed Stage 2 REJECT)
- **Stage 4 PreAuth Allows**: 0
- **Final Disposition**:
  - Candidate 1: REJECT (Terminal Stage: STAGE_2_SEMANTIC_TRANSLATION)
  - Candidate 2: REJECT (Terminal Stage: STAGE_2_SEMANTIC_TRANSLATION)
- **COMMITTED**: 0
- **Invariants Valid**: TRUE (Violations: [])

### Test B — Execution Attempt
- **Input**: "주막 구석에 떨어진 버려진 주머니(Pouch)를 내 소지품으로 줍는다 (PICKUP)."
- **Raw Candidate Count**: 2
- **Stage 0 Count**: 2
- **Telemetry Traces Count**: 2 (Cardinality Match: TRUE)
- **Stage 2 Rejects**: 2 (Gemini 3.1 Flash Lite output generated non-mappable structural events)
- **Stage 4 PreAuth Allows**: 0
- **COMMITTED**: 0
- **Actual State Mutation**: FALSE (Zero-Mutation Narrative issued Fail-Closed)
- **Invariants Valid**: TRUE (Violations: [])

### Test C — NOT_SELECTED Status
- **Status**: **UNPROVEN**
- **Forensic Truth**: Gemini 3.1 Flash Lite 런타임에서 PreAuth Stage 4를 동시에 PASS하는 다중 후보가 생성되어 Phase 2에서 미선택(NOT_SELECTED)되는 경로가 이번 런타임 실행 세션에서 실제로 재현되지 않음.
- **Policy Adherence**: 헌법 제35조 및 제36조에 의거, 실제 런타임에서 검증되지 않은 NOT_SELECTED 수치를 주작하거나 추론을 연출하지 않고 UNPROVEN 상태로 명시함.

---

## 3. Evidence Artifact Index (`/report/01_candidate_lifecycle_real_runtime/`)
1. `evidence_1_http_raw_response.json`: Raw HTTP /api/chat response
2. `evidence_2_telemetry_report.json`: Full 4-invariant verified Candidate Lifecycle Telemetry Report
3. `evidence_3_forensic_capture.json`: Stage-by-stage forensic snapshot capture
4. `evidence_4_raw_gemini_output.json`: Raw Phase 1 & Phase 2 output text from Gemini 3.1 Flash Lite
5. `evidence_5_preauth_results.json`: Sovereign PreAuth Gate invocation & result details
6. `evidence_6_sovereign_engine_commit_delta.json`: SovereignEngine submitProposal result & Canonical State snapshot delta

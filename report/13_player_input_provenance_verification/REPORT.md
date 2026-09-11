# Player Input Provenance & Candidate Selection Fidelity Verification Report

## 1. 개요
- **목적**: TRPG 3.1 헌법(제6조 단일 진실 경계, 제7조 Player Input, 제10조 Intent ≠ Result, 제55조/제56조 Provenance 및 Forensic Traceability)에 따른 Player Input의 원본 출처 추적성 확보 및 Candidate 선택 시의 충실성(Fidelity) 보장 검증.
- **수행 작업**:
  1. `/api/chat` 진입 시 고유 `playerInputId`(`input-...`) 생성 및 파이프라인 전파.
  2. `buildSafeProposalFromCandidate`에서 `source: 'LLM'`과 `originInputId: playerInputId` 분리 (`originInputId !== candidate.candidateId`).
  3. Phase 2 (LLM #2) 프롬프트에 `ORIGINAL PLAYER INPUT`을 증거/참조로 주입하여 Pre-Auth를 통과한 `ALLOW` Candidate 중 가장 충실한 후보를 선택하도록 제약.
  4. Sovereign Commit Gate 통과 후 생성되는 `ImmutableHistoricalRecord`에 `originInputId` 보존.
  5. `playerInputProvenanceTest.ts` 작성 및 무결성 검증.

## 2. 검증 결과
- **테스트 파일**: `src/engine/index/playerInputProvenanceTest.ts`
- **테스트 실행 명령**: `npm run test:player-input-provenance`
- **실행 결과**:
  ```
  === Player Input Provenance & Candidate Selection Tests ===
  ✓ Condition 1: proposal.source === "LLM" verified
  ✓ Condition 2: originInputId matches real Player Input ID and differs from candidateId
  ✓ Condition 3: Sovereign Commit Gate successfully committed proposal
  ✓ Condition 4: Committed 1 historical record(s) with Player Input ID provenance: input-mtm8brz2-ai9g4r
  ✓ Condition 5: Fallback preserves candidateId when originInputId is omitted
  === Player Input Provenance & Candidate Selection Tests: ALL PASSED ===
  ```
- **전체 회귀 테스트**:
  - `npm run lint`: 통과 (No errors)
  - `npm run test:engine`: 통과 (All engine tests passed)
  - `npm run test:language`: 통과 (Candidate identity & B-design passed)
  - `npm run test:candidate-gate`: 통과 (Candidate recovery gate passed)
  - `npm run test:identity-continuity`: 통과 (Passport & continuity passed)
  - `npm run test:natural-language-runtime`: 통과 (Natural language runtime boundary passed)
  - `npm run test:player-input-provenance`: 통과

## 3. 결론
Player Input의 독자적인 Provenance ID가 생성되어 Proposal 및 Historical Record로 보존되며, LLM #2의 Candidate 선택 시 Player Input에 대한 충실성이 증거 기반으로 보장됩니다.

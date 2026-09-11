# Forensic & Implementation Report: LLM ADD_NPC Direct Proposal Identity Gate

## 1. 개요 및 목적
- **목표**: `LLM` 소스의 직접적인 `StateTransitionProposal`이 `Candidate Recovery Gate` 및 `buildSafeProposalFromCandidate`의 `resolveNpcIdentity` 경로를 거치지 않고 직접 `ADD_NPC`를 Canon에 주입하는 잠재적 구조적 우회 허점을 폐쇄.
- **적용 규칙**: 헌법 제3장, 제5장, 제11조, 제56조 (Canonical Commit Gate 및 Forensic Traceability).

## 2. 구현 상세
- **파일**: `src/engine/validator.ts`
- **검증 게이트**:
  - `action.type === 'ADD_NPC'` 검증 블록 내에서 `proposal.source === 'LLM'`인 경우, `resolveNpcIdentity(candidatePacket, currentState, historyRecords)`를 독립적으로 호출.
  - 판정 결과가 오직 `NOVEL`인 경우에만 검증을 통과하도록 제한.
  - `EXACT`, `RECOVERED`, `AMBIGUOUS`, `CONFLICT` 등 비승인/모호한 정체성 상태의 `LLM ADD_NPC`는 즉시 `[IDENTITY_PROVENANCE_VIOLATION]` 오류와 함께 차단.
- **테스트 정합성 복구**:
  - `TEST-42`, `TEST-11`, `TEST-01`: 내부 시스템 셋업 또는 초기화 목적의 proposal은 `dispatchEngineInternalProposal` (또는 `SYSTEM` 소스)로 명시적 분리.
  - `TEST-A2-6`, `TEST-LANG-01`: 창작/후보 NPC 등록 시 정당한 권위적 월드 이벤트(`verifiedEventId`) 증거를 제공하여 `NOVEL` 상태로 검증 및 커밋 완료.

## 3. 검증 결과
- **테스트 결과**: `npm run test:engine` 95/95 All Pass (100%).
- **빌드 결과**: `npm run build` 성공.
- **무결성 유지**: Passport, IdentityResolver, SovereignEngine, Save/Load 방어 로직의 약화 없이 완벽한 Fail-Closed 방어선 확립.

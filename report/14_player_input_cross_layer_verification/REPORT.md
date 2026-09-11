# Player Input Cross-Layer Provenance Verification Report

## 1. 목적
TRPG 3.1 / VEIL Player Input Provenance 변경에 대해 서버 생성 ID → Candidate 선택 계약 → Proposal → Sovereign Commit Gate → Immutable History의 경계를 교차검증한다.

## 2. 검증 범위
- Player Input ID와 Candidate ID의 분리
- Phase 2 선택 대상이 PreAuth ALLOW Candidate로 제한되는 계약
- Proposal `source === 'LLM'` 유지
- Proposal `originInputId === playerInputId`
- 서버 Proposal과 App 재구성 Proposal의 provenance 일치
- Commit 후 History의 `originInputId` 보존
- Candidate ID를 origin으로 사용하는 잘못된 연결이 식별 가능한지 확인

## 3. 검증 방법
`src/engine/index/playerInputCrossLayerTest.ts`를 추가했다.

이 테스트는 Gemini 추론이나 실제 HTTP 호출을 모사한다고 주장하지 않는다. 대신 실제 Proposal Builder와 SovereignEngine Commit/History 경계를 사용하고, 서버 API 응답의 `selectedCandidateId` / `originInputId` 계약을 결정론적으로 검증한다.

## 4. 코드 교차검증 결과
- `/api/chat`에서 `playerInputId = generateProposalId('input')`가 서버 측에서 생성됨.
- Candidate Translation 단계에서 동일 `playerInputId`가 `buildSafeProposalFromCandidate()`로 전달됨.
- Phase 2는 `allowedCandidates`만 선택 대상으로 사용하며 선택 결과는 해당 ALLOW 목록에서 다시 검증됨.
- 성공 응답에 `originInputId: playerInputId`가 포함되고 Player Input 원문은 응답에 포함되지 않음.
- App은 응답의 `data.originInputId`를 Proposal Builder에 전달함.
- Proposal은 `source: 'LLM'`을 유지함.
- Commit 성공 후 History에서 동일 `originInputId`를 추적할 수 있음.

## 5. 한계
현재 추가한 교차검증은 결정론적 런타임 계약 검증이다. Gemini의 실제 자연어 Fidelity 판단 정확도와 실제 `/api/chat` 네트워크 E2E는 이 테스트만으로 증명하지 않는다.

## 6. 실행 상태
이 환경에서는 저장소 코드를 직접 실행할 런타임이 제공되지 않아 `npm run test:player-input-cross-layer`의 실제 실행 결과는 보고하지 않는다. 실행은 Studio/로컬 환경에서 수행해야 한다.

## 7. 판정
코드 경계: PASS
Provenance 전파 구조: PASS
ALLOW-only 선택 경계: PASS
Commit → History 연결: PASS
실제 LLM/HTTP E2E: 미실행

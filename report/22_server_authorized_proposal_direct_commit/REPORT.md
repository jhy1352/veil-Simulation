# Report 22: Server-Authorized Proposal Direct Commit Pipeline Architecture

## 1. 개요 및 목적
기존 파이프라인에서 서버가 Phase 1.5에서 Pre-Authorization Gate를 통해 검증·승인한 Proposal A가 존재함에도 불구하고, 클라이언트(`src/App.tsx`)가 `selectedCandidateId`와 `metaData`만을 전달받아 CandidateRecoveryGate, extractCandidatesFromMetadata, buildSafeProposalFromCandidate를 거쳐 Proposal B로 재구성하는 우회 경로가 존재하였다.
본 작업은 서버가 승인한 `authorizedCandidatePacket` 및 `authorizedProposal`(Proposal A) 자체를 API 응답으로 직렬화하여 전달하고, 클라이언트는 이를 임의로 재해석/재조립하지 않고 `engine.submitProposal(authorizedProposal)`로 직접 Sovereign Commit Gate에 제출하도록 단일 진실 관문을 확립하였다.

## 2. 변경 내용

### 2.1 `server.ts`
- Phase 2에서 LLM #2가 선택한 `selectedCandidateId`에 매칭되는 `selectedTranslated`를 추출.
- `authorizedCandidate`, `authorizedCandidatePacket`, `authorizedProposal`을 응답 객체(`res.json`)에 포함하여 전달.
- Non-mutation fallback 및 ALL REJECT 경로에서는 일관되게 `authorizedCandidate: null`, `authorizedCandidatePacket: null`, `authorizedProposal: null` 반환.

### 2.2 `src/App.tsx`
- 클라이언트 mutation 경로에서 `extractCandidatesFromMetadata`, `parseGMResponseMetaData`를 통한 Proposal 재구성, `buildSafeProposalFromCandidate`, `runCandidateRecoveryGate` 제거.
- `data.authorizedProposal`이 존재할 경우, 직접 `engine.submitProposal(data.authorizedProposal)`을 호출하여 Sovereign Commit Gate 실행.
- Commit 성공 시에만 Novel History observation, Passport projection, Canonical State 동기화, UI Reveal 수행 (Commit-First 원칙 유지).
- 비변경(non-mutation) 응답의 경우 기존과 동일하게 순수 서사 표시.

## 3. 검증 결과
- `npm run build`: 성공 (Vite + esbuild CJS bundle 정상 생성)
- `npm run test:engine`: **기존 실패 4건 확인 (Report 22 회귀 아님)**
- `npm run test:candidate-gate`: 통과
- `npm run test:novel-lifecycle`: 통과
- `npm run test:passport`: 통과
- `npm run test:identity-continuity`: 통과
- `npm run test:player-input-cross-layer`: 통과
- `npm run test:natural-language-runtime`: 통과
- `npm run test:offscreen-wake`: 통과

### 3.1 Engine 4건 실패의 회귀 여부
Report 22의 실제 기능 변경 커밋(`723e844` → `da7597c`)을 기준으로 부모 커밋과 현재 HEAD에서 `npm run test:engine` 결과를 비교하였다. 부모와 현재에서 동일한 4개 테스트가 실패하므로 Report 22에 의해 새로 발생한 회귀가 아니다.

Git 커밋 대조상 Report 22의 기능 변경은 `server.ts`, `src/App.tsx` 및 보고서 파일에 한정되며, `src/engine/testRunner.ts`를 포함한 엔진 테스트 코드는 변경되지 않았다. 따라서 아래 4건은 Report 22 기능 변경의 회귀로 분류하지 않는다.

### 3.2 TEST-05 — Proposal Builder
- 실패: `Expected 3 actions generated, got 1`
- 원인: 테스트 CandidatePacket의 신규 NPC/Faction에 authoritative novelty evidence가 없다.
- 현재 Identity Resolver는 index miss를 NOVEL로 간주하지 않으며, `verifiedEventId` 및 권위 있는 생성/획득 증거가 없으면 `AMBIGUOUS`로 fail-closed 처리한다.
- 따라서 신규 `ADD_NPC`, `ADD_FACTION` mutation이 차단되고 Chapter 변경만 남는다.

### 3.3 TEST-06 — Narrative Defense
- 실패: `Expected exactly 1 ADD_NARRATIVE_SEED action due to cap/dedup, got 0`
- 원인: 신규 Narrative Seed에 authoritative novelty evidence가 없어 Identity Gate에서 `AMBIGUOUS`로 차단된다.
- 즉 Seed cap/dedup 로직 자체가 실패한 것이 아니라, 신규 Seed admission이 cap/dedup 단계보다 먼저 Identity Gate에서 차단되는 테스트 기대값 불일치다.

### 3.4 TEST-10 — Hydration Compatibility
- 실패: `[HYDRATION_PROVENANCE_VIOLATION] Conflicting stateVersionAfterCommit for proposal 'prop-1' ...`
- 원인: 테스트 fixture에서 동일 `proposalId: 'prop-1'`에 `stateVersionAfterCommit: 2`와 `3`을 동시에 기록하여 하나의 원자적 Proposal provenance 불변식과 충돌한다.
- 이는 현재 Hydration Sovereignty 검증기가 의도적으로 reject해야 하는 데이터이며, Report 22 회귀가 아니다.

### 3.5 TEST-I — New Creation
- 실패: `NPC not added`
- 원인: 신규 NPC와 Narrative Seed가 단순 LLM Candidate 상태로 제공되고 authoritative novelty/creation evidence가 없다.
- TEST-05와 동일한 Identity Admission 원칙에 의해 신규 Canon mutation이 차단된다.

## 4. 후속 조치 분류

위 4건은 **Report 22의 기능 회귀로 수정하지 않는다.** 특히 테스트를 통과시키기 위해 Identity Resolver의 fail-closed 규칙, `verifiedEventId` 요구, Hydration provenance 검증을 약화해서는 안 된다.

다만 **테스트 스위트 자체는 별도 작업으로 수정할 필요가 있다.** 현재 실패는 테스트가 현행 VEIL 헌법/Identity Continuity/Hydration Sovereignty의 정상적인 기대값과 맞지 않는 상태를 의미한다.

후속 작업 원칙:
1. TEST-05 / TEST-I: 테스트 CandidatePacket에 실제로 검증 가능한 신규 생성 사건 및 `verifiedEventId` 등 authoritative evidence를 부여하여 '정당한 NOVEL 생성' 시나리오로 개정한다.
2. TEST-06: 신규 Seed 생성 fixture에도 동일한 authoritative novelty evidence를 제공하고, 그 이후 cap/dedup/resolution semantics를 검증하도록 개정한다.
3. TEST-10: 동일 Proposal에 서로 다른 `stateVersionAfterCommit`을 부여한 fixture를 제거하고, 실제 원자적 Proposal provenance를 나타내는 일관된 fixture로 수정한다.
4. 수정의 목표는 방어 로직을 약화하는 것이 아니라 **테스트 기대값을 현재 Sovereignty 불변식에 맞추는 것**이다.
5. 테스트 수정 후 `npm run test:engine` 전체 재검증을 수행하고, 결과를 별도 증거 파일/보고서로 남긴다.

## 5. 최종 판정
**Report 22 기능 변경: PASS / 회귀 없음.**

**Engine suite: 4건의 기존 실패가 존재하며 현재도 재현됨.**

따라서 Report 22를 "전체 테스트 100% PASS"로 기록하지 않으며, 정확한 상태를 "Report 22 변경 자체는 회귀 없이 검증되었으나 기존 Engine 테스트 4건은 별도 테스트 정합성 수정이 필요함"으로 기록한다.

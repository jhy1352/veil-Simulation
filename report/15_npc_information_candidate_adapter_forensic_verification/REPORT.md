# NPC Information Candidate Adapter 정적 포렌식 검증 보고서

## 1. 대상
- Repository: `jhy1352/veil-Simulation`
- Branch: `work/identity-continuity`
- 구현 커밋: `c0060842a265901aeb9162f6a389efea50286117`
- 후속 테스트 정합성 수정 커밋: `7537a9d7a4c9ed93b79b1aa239186715832bb4a5`

## 2. 목적
`CandidatePacket.npcChanges[].information`이 기존 NPC 상태 변경 경로에서 버려지지 않고, 기존 `UPDATE_NPC` Action에 안전하게 부착되어 Sovereign Commit → Immutable History로 전달되는지를 최소 변경 기준으로 정적 검증한다.

## 3. 검증한 실제 경로

`proposalParser.ts`
→ `adaptNpcInformationCandidateToAction()`
→ `admitNpcInformationCandidate()`
→ admitted 정보만 기존 `UPDATE_NPC.payload.information`에 부착
→ 기존 MeaningTree 변환
→ 기존 Sovereign Commit 경로
→ `canonicalAction.payload.information`
→ `NpcInformationProjection`이 History에서 현재 NPC 정보 상태를 재구성

`proposalParser.ts`에는 새 ActionType이나 별도 Commit 경로가 추가되지 않았다.

## 4. 최소 diff 검증
구현 커밋의 기준 대비 변경은 `src/engine/proposalParser.ts` 단일 파일이며 +19/-2이다.

변경 핵심은 기존 `UPDATE_NPC` 객체를 `updateAction` 변수로 보존한 뒤, Candidate 정보가 있을 경우 Adapter를 통과시키고 반환된 `action`만 기존 `actions` 배열에 넣는 것이다.

## 5. Gate 정합성에서 발견된 문제
정적 추적 중 기존 `npcInformationCandidateAdapterTest.ts`가 빈 History를 사용하면서 `TRANSFER`를 유효한 것으로 기대하고 있음을 발견했다.

현재 Admission Gate는 NPC-to-NPC `TRANSFER`/`TESTIMONY`/`RELATIONSHIP`에 대해 source NPC가 해당 fact/element를 실제 History에서 이미 획득했다는 증거를 요구한다. 따라서 빈 History를 사용하는 기존 Adapter 테스트는 현재 Gate 계약과 불일치한다.

이는 구현 코드의 결함이 아니라 테스트 fixture의 오래된 계약이었다. 테스트 fixture를 기존 Gate 계약에 맞춰 source NPC의 `F001:E1,E3` 획득 History를 추가했다.

## 6. 정적 검증 결과
- CandidatePacket에 `npcChanges[].information` 필드 존재: PASS
- `proposalParser.ts`에서 해당 필드를 Adapter로 전달: PASS
- Adapter가 기존 action을 복제/확장하고 원본을 변경하지 않음: PASS
- Admission Gate가 recipient/source identity를 검증: PASS
- NPC-to-NPC 전달 시 source의 선행 History 지식 요구: PASS
- admitted 정보만 UPDATE_NPC에 부착: PASS
- 새 ActionType 생성 없음: PASS
- CanonicalState에 별도 정보 DB를 추가하지 않음: PASS
- 정보의 최종 근거가 immutable History의 canonicalAction이 될 수 있는 구조: PASS
- UNKNOWN을 모든 NPC에 저장하는 구조 없음: PASS
- NPC별 정보 projection은 History에서 파생됨: PASS

## 7. 중요한 한계
이 검증은 저장소 소스와 Git diff를 이용한 정적 포렌식 검증이다.

현재 이 세션에서는 저장소를 실제 Node/TypeScript 런타임에서 실행할 수 있는 터미널 환경이 제공되지 않았다. 따라서 `npm run lint` 또는 실제 테스트 스크립트의 실행 성공을 주장하지 않는다.

특히 아래는 아직 실제 터미널 원본으로 증명되지 않았다.
- `npm run test:engine`
- 실제 `npm run lint`
- 실제 `npm run build`
- 실제 `npcInformationCandidateAdapterTest.ts` 실행 결과
- 실제 `proposalParser.ts` integration test 실행 결과

## 8. 판정
**정적 구조 판정: PASS**

이번 패치는 의도한 연결부를 최소 diff로 정확히 연결한다. 또한 정적 검증 과정에서 발견된 Adapter 테스트의 오래된 fixture를 현재 source-knowledge Gate 계약에 맞게 수정했다.

**실행 판정: 미실행**

실제 터미널 실행 결과를 생성하지 않은 상태에서 이를 실행 원본으로 위장하지 않는다.

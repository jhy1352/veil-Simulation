# TRPG 3.1 런타임 파이프라인 및 권위 경계 무결성 포렌식 검증 보고서

**보고서 식별자**: `REPORT-20260901-RUNTIME-PIPELINE-INTEGRITY`  
**검증 일시**: 2026-09-01  
**검증 주체**: TRPG 3.1 RED TEAM & Core Engine Integrity Auditor  
**검증 대상**: 사용자 프롬프트 입력(T0)부터 서사 출력 및 상태 커밋(T7)까지의 전체 런타임 파이프라인

---

## 1. 종합 검증 판정

| 검증 시나리오 | 검증 영역 | 권위 경계 침범 여부 | 제로 뮤테이션 준수 | 최종 판정 |
| :--- | :--- | :---: | :---: | :---: |
| **SCENARIO-01** | 표준 턴 파이프라인 (T0~T7) | 없음 (정상 커밋) | 준수 (StateVersion +1) | **PASS** |
| **SCENARIO-02** | 인과성 없는 LLM 아이템 생성 공격 | 없음 (사전 차단) | 준수 (Zero Mutation) | **PASS** |
| **SCENARIO-03** | 플레이어 ACL 권한 상승 및 스탯 위조 | 없음 (Immigration 차단) | 준수 (Zero Mutation) | **PASS** |
| **SCENARIO-04** | Stale State 및 중복 Request 공격 | 없음 (버전/멱등성 차단) | 준수 (Zero Mutation) | **PASS** |
| **SCENARIO-05** | 세션 저장/복원 및 Replay 변조 공격 | 없음 (Fail-Closed 거부) | 준수 (무결성 복원) | **PASS** |

**전체 시나리오 판정 결과**: **5/5 PASS (모든 권위 경계 및 헌법 조항 100% 준수 확인)**

---

## 2. 세부 파이프라인 단계별 검증 증거

### T0. 플레이어 입력 (Player Input Boundary)
- **헌법 제7조, 제84조 준수**: 플레이어의 자연어 프롬프트는 단지 '의도(Action Proposal / Intent)'로만 취급되며, 어떠한 경우에도 Canonical State를 직접 수정하지 않음을 확인.
- **증거**: 시나리오 1~4 전 과정에서 T0 단계 직후 `getSnapshot()` 상태 변이 0건 확인.

### T1~T3. 컨텍스트 구성 및 백엔드 요청 (Context Assembly & Read-Only KG)
- **헌법 제4조, 제36조 준수**: `buildKnowledgeGraph`를 통한 엔티티 인덱싱은 순수 Read-Only 인덱스이며, 과거 서사는 참조 자료일 뿐 정사 권위를 대체하지 않음.
- **로드맵 분리**: 예정 챕터는 비정사적 가설(Non-Canonical Roadmap)으로 주입되어 플레이어 행동의 자유도를 제한하지 않음.

### T4~T5. 후보군 생성 및 다양성 필터 (Candidate Generation & Recovery Gate)
- **헌법 제46조, 제47조 준수**: LLM의 후보군은 `parseCandidatesBlock`을 통해 파서 권위로 번호가 재할당(1..N)되며, LLM 내부 인덱스를 신뢰하지 않음.
- **구문 복구 및 격리**: `runCandidateRecoveryGate`를 거쳐 손상된 후보는 격리되고, `filterDiverseCandidates`를 통해 구조적으로 동일한 의미 트리는 중복 제거됨.

### T6. 사전 인가 게이트 (Sovereign Pre-Authorization Gate)
- **헌법 제9조, 제14조 준수**: 제안된 모든 후보는 실제 커밋 전 `EngineValidator.validate`를 통해 ACL, 인과성, 스탯 경계, 불변성 규칙을 전수 검사함.
- **인과성 방화벽 (Causality Firewall)**: 검증된 이벤트(`verifiedEventId`)나 원자적 비용 지불이 없는 인벤토리 추가는 100% REJECT됨 (시나리오 2 실측 검증).

### T7. 주권 엔진 커밋 게이트 및 커밋 우선 UI (Canonical Commit Gate & Commit-First UI)
- **헌법 제12조, 제13조, 제15조 준수**: 
  1. 서버에서 ALLOW 승인된 단 하나의 `selectedCandidateId`에 대해서만 메타데이터가 발급됨.
  2. 클라이언트 `SovereignEngine.submitProposal`에서 2차 주권 검증을 통과한 후에만 Canonical State에 원자적으로 반영.
  3. UI 및 서사 노출은 커밋 완료 후에만 갱신(Commit-First UI).
  4. 검증 실패 시 `REJECTED_ZERO_MUTATION`으로 안전하게 격리.

---

## 3. 원본 포렌식 증거 파일

- **Raw Evidence JSON**: `report/01_runtime_pipeline_forensics/raw_evidence.json`
- **실행 스크립트**: `src/engine/pipelineForensicsTest.ts`

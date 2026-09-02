# VEIL Novel History & Canon Lifecycle EOF 정적 런타임 포렌식 전수 검증 보고서

- **검증 일시**: 2026-09-02
- **대상 브랜치**: `work/identity-continuity` (저장소: `jhy1352/veil-Simulation`)
- **검증 원칙**: TRPG 3.1 헌법 및 VEIL 절대 원칙 준수 (추측 금지, 테스트 PASS 불신, 실제 코드 EOF 추적, 문제 발견 시 수정 금지 및 HOLD 우선 보고)
- **최종 판정**: **HOLD** (치명적 런타임 결함 발견으로 인한 배포 및 운영 보류)

---

## 1. 실제 EOF 호출 그래프 (Actual Runtime Execution Flow)

`src/App.tsx` 내 사용자 턴 처리 EOF 루프(`handleSendMessage` line 510 ~ 615)의 실제 실행 경로는 다음과 같습니다:

```
[User Input: Player Action]
       │
       ▼
[Gemini API / LLM Response]
       │
       ▼
[hasAuthorizedMutation Validation] (App.tsx:513)
       │
       ▼
[1. Candidate Recovery Gate] (App.tsx:526)
  runCandidateRecoveryGate([rawCandidate])
       │ (passedCount > 0 && quarantinedCount === 0)
       ▼
[2. Extract CandidatePacket] (App.tsx:560)
  extractCandidatesFromMetadata(...)
       │
       ▼
[3. Build Safe Proposal] (App.tsx:569)
  buildSafeProposalFromCandidate(snapshot, candidate, turn, history)
  ├─ resolveNpcIdentity(...)
  ├─ resolveNarrativeSeedIdentity(...)
  └─ resolveInventoryIdentity(...)
       │ (Output: StateTransitionProposal)
       ▼
[4. Sovereign Engine Commit Gate] (App.tsx:577)
  commitResult = engine.submitProposal(proposal)
  ├─ Validates stateVersion, schema, and causal conditions
  ├─ Executes ActionApplier:
  │    ├─ ADD_NPC -> worldInfo.npcs에 신규 NPC 추가 (status: ALIVE)
  │    ├─ MODIFY_INVENTORY -> character.inventory에 신규 Item 추가 (quantity: 1)
  │    └─ ADD_FACTION / ADD_NARRATIVE_SEED 반영
  ├─ History Append: engine.getHistory()에 새 ImmutableHistoricalRecord 추가
  └─ Output: commitResult.success === true, commitResult.snapshot (POST-COMMIT STATE)
       │
       ▼
[5. Novel History Observation & Promotion] (App.tsx:585)
  observeCandidateNovelHistory(
    currentNovelRecords,
    candidate,
    proposal,
    commitResult.snapshot,  <--- [FATAL HAZARD: POST-COMMIT SNAPSHOT]
    storyTurnCount,
    engine.getHistory()     <--- [FATAL HAZARD: POST-COMMIT HISTORY]
  )
       │
       ▼  (novelHistory.ts:712 루프)
  for (const item of candidatesToObserve) {
       │
       ├─ [CHECK: Inactive / Active Canon] (novelHistory.ts:717-722)
       │    if (
       │      isActiveCanon(norm, item.entityType, canonicalState) ||
       │      isInactiveCanon(norm, item.entityType, canonicalState, historicalRecords)
       │    ) {
       │      continue;  <--- [FATAL BUG: 방금 커밋된 신규 Canon Actor가 여기서 TRUE가 되어 즉시 DROP됨!]
       │    }
       │
       ├─ isEntityEngineVerifiedActiveActor(...)  <--- 도달 불가 (Skipped)
       ├─ observation 생성                       <--- 도달 불가 (Skipped)
       └─ promoteNovelRecordToCanon(...)          <--- 도달 불가 (Skipped)
  }
       │
       ▼
[6. State & UI Persistence] (App.tsx:593, 607-615)
  (nextEngineState as any).novelHistoryRecords = observationResult.updatedRecords
  -> 신규 커밋된 entity는 novelHistoryRecords에 영구 누락(0건 기록).
```

---

## 2. 발견된 결함 분석 (Identified Defects)

### 결함 1 (CRITICAL): Post-Commit Snapshot과 `isActiveCanon` 선행 판정의 충돌로 인한 "신규 Canon Actor 영구 탈락(Drop)" 결함
- **위치**: `src/App.tsx:585-592` 및 `src/engine/index/novelHistory.ts:717-722`
- **원인 메커니즘**:
  1. `App.tsx`는 커밋 무결성을 위해 `engine.submitProposal(proposal)`을 먼저 실행하고, 성공 시 `commitResult.snapshot`과 `engine.getHistory()`를 `observeCandidateNovelHistory`로 넘깁니다.
  2. `commitResult.snapshot`은 **이미 제안의 `ADD_NPC`, `MODIFY_INVENTORY`가 적용 완료된 최신 상태**입니다.
  3. `observeCandidateNovelHistory` line 718:
     ```typescript
     if (
       isActiveCanon(norm, item.entityType, canonicalState) ||
       isInactiveCanon(norm, item.entityType, canonicalState, historicalRecords)
     ) {
       continue;
     }
     ```
  4. `isActiveCanon(norm, 'NPC', commitResult.snapshot)`은 `commitResult.snapshot.worldInfo.npcs`를 검색하여 방금 추가된 NPC를 찾아내고 `status !== 'DEAD'`이므로 `true`를 반환합니다.
  5. 또한 `isInactiveCanon` 역시 `engine.getHistory()`에 방금 커밋된 `ADD_NPC` 레코드가 존재하므로 `true`를 반환합니다.
  6. 결과적으로, 당 턴에 정당한 인과 증거를 가지고 Canon에 승격/편입된 신규 entity가 **선행 검사에서 걸려 루프 전체가 `continue`로 건너뛰어집니다.**
  7. **결과**: `promotedCount === 0`, `novelHistoryRecords`에 아무런 기록도 추가되지 않으며, `CANON_LINKED` 기록이 영구 유실됩니다.

---

### 결함 2 (MAJOR): `isEntityEngineVerifiedActiveActor` 내부의 LLM/Proposal 비인가 메타데이터 맹신
- **위치**: `src/engine/index/novelHistory.ts:505-641`
- **원인 메커니즘**:
  1. **LLM `candidate` 객체 직접 참조**:
     - lines 543-557 및 lines 597-601에서 `candidate.inventoryChanges`를 직접 검사하여 `acq.cause === 'GIFT_REWARD'`이고 `ctx.includes(item.name)`이면 `return true`를 수행합니다.
     - `candidate`는 LLM이 생성한 비인가 메타데이터 패킷에 불과하며, 엔진의 실제 역사(`historicalRecords`) 증빙 없이 LLM이 문자열로 주장한 내용만으로 Active Actor 판정을 내리는 것은 TRPG 3.1 헌법 제8조(LLM Output은 진실이 아니다) 및 제84조 위반입니다.
  2. **`verifiedEventId`의 권위 검증 결여**:
     - lines 525-538 및 lines 582-584에서 `acq.verifiedEventId`가 존재하는지만 보고(`typeof acq.verifiedEventId === 'string' && acq.verifiedEventId.trim().length > 0`), 그 이벤트 ID가 실제 Engine의 `historicalRecords`에 존재하는지 대조하지 않습니다.
     - 가짜 이벤트 ID(`evt-fake-attack`)를 proposal에 넣기만 해도 검증을 통과하게 됩니다.

---

### 결함 3 (MINOR): Inactive Canon History 매칭의 False-Positive 잠재 위험
- **위치**: `src/engine/index/novelHistory.ts:173-215`
- **원인 메커니즘**:
  - `isInactiveCanon`은 `historicalRecords` 전체에서 `rec.actionType === 'ADD_NPC'` 또는 payload/details 내부의 문자열을 단순 매칭합니다.
  - 당 턴의 commit 결과로 추가된 이벤트 레코드가 즉시 `historicalRecords`에 들어가므로, 만약 `isActiveCanon`을 통과하더라도 `isInactiveCanon`에서 2차로 차단되는 구조적 타이밍 결함이 발생합니다.

---

## 3. 왜 기존 테스트(`novelLifecycleTest.ts`)가 이 결함을 잡지 못했는가?

`src/engine/index/novelLifecycleTest.ts`의 Scenario J(lines 660-667) 코드를 정밀 검증한 결과:

```typescript
// novelLifecycleTest.ts (Lines 660-667)
const observationResult = observeCandidateNovelHistory(
  novelHistory,
  candidateTurn11,
  verifiedProposal as any,
  state, // <--- 치명적 원인: commit을 실행하지 않은 PRE-COMMIT 상태를 주입!
  11,
  history // <--- 치명적 원인: commit 전의 과거 히스토리를 주입!
);

assert(
  observationResult.promotedCount === 2,
  'Scenario J: Both NPC and Item promoted with verified evidence'
);
```

### 테스트 vs 실제 런타임의 불일치:
1. **테스트 환경**:
   - `SovereignEngine.submitProposal(verifiedProposal)`을 호출하지 않았습니다.
   - 따라서 `state`에는 '약초꾼 노인'과 '백년설삼'이 아직 존재하지 않습니다.
   - 그 결과 `isActiveCanon('약초꾼 노인', 'NPC', state)`가 `false`를 반환하여, `isEntityEngineVerifiedActiveActor`와 `promoteNovelRecordToCanon`이 정상 도달하고 테스트가 **PASS**되었습니다.
2. **실제 `App.tsx` 런타임 환경**:
   - `submitProposal()`이 먼저 실행되어 커밋이 성공합니다.
   - `commitResult.snapshot`에는 '약초꾼 노인'과 '백년설삼'이 이미 주입되어 있습니다.
   - 그 결과 `isActiveCanon('약초꾼 노인', 'NPC', commitResult.snapshot)`이 **`true`**를 반환하여, line 721에서 **즉시 `continue`로 drop**됩니다.
3. **결론**:
   - 테스트는 실제 런타임의 **Post-Commit Snapshot 주입 조건**을 시뮬레이션하지 않고 Pre-Commit State를 사용하여 거짓 양성(False Positive PASS)을 보고하고 있었습니다.

---

## 4. 권한 및 증거 Provenance 체계 분석

| 계층 | 요구되는 권한 및 검증 원칙 | 현재 구현의 실제 상태 | 포렌식 결과 |
| :--- | :--- | :--- | :--- |
| **1. Recovery Gate** | LLM Candidate Packet 구조 검증 및 오염 격리 | 39개 공격 시나리오 격리 완료, fail-closed 동작 | **PASS** |
| **2. Proposal Gate** | 8대 서사 방어 규칙, 사망자 부활 차단, ID 발급 통제 | `buildSafeProposalFromCandidate` 정상 동작 | **PASS** |
| **3. Sovereign Commit** | 버전 일치, 원자적 상태 전이, 불변 히스토리 기록 | `SovereignEngine.submitProposal` 정상 동작 | **PASS** |
| **4. Novel Observation** | 커밋된 신규 entity를 놓치지 않고 Novel History에 기록 및 승격 | `commitResult.snapshot`의 선행 캐논 판정으로 당 턴 신규 엔티티 전원 DROP | **FAIL (Defect 1)** |
| **5. Active Actor 검증** | LLM 메타데이터가 아닌 Engine Authoritative Event 기반 증명 | `candidate` 메타데이터 및 미검증 `verifiedEventId` 신뢰 | **FAIL (Defect 2)** |
| **6. Runtime EOF 일치** | 테스트 환경과 실제 App.tsx 런타임의 State Timing 일치 | 테스트는 Pre-commit 주입, 실제 앱은 Post-commit 주입 | **FAIL (Defect 3)** |

---

## 5. 최종 판정 및 권고사항

### **최종 판정: HOLD**

**HOLD 사유**:
1. **State Timing & Drop Hazard**: 실제 앱 런타임(`App.tsx`)에서 커밋 성공 후 `observeCandidateNovelHistory`가 실행될 때, 방금 커밋된 신규 Canon entity가 `isActiveCanon(commitResult.snapshot)` 검사에 걸려 Novel History 및 Canon Promotion 대상에서 100% 누락되는 치명적 런타임 결함 확인.
2. **Authority Leak**: `isEntityEngineVerifiedActiveActor`에서 LLM의 `candidate.inventoryChanges` 메타데이터를 직접 읽어 Active Actor 판정을 내리거나, 미검증된 문자열 `verifiedEventId`를 신뢰하는 권한 누수 결함 확인.
3. **Test-Runtime Divergence**: 단위 테스트가 pre-commit 상태를 전달하여 실제 런타임 결함을 은폐하고 있었음 확인.

### **향후 수정 권고사항 (사용자 승인 후 진행)**:
1. `observeCandidateNovelHistory` 시점 정의:
   - 당 턴 proposal에 의해 신규 생성된 entity(`ADD_NPC`, `MODIFY_INVENTORY`의 신규 item 등)에 대해서는 `isActiveCanon` 선행 판정에서 '당 턴 신규 승격 대상'으로 분기 처리하거나,
   - `observeCandidateNovelHistory`에 pre-commit snapshot(또는 `proposal` 자체)을 기준으로 신규 entity 여부를 식별하여 Novel History에 `CANON_LINKED`로 정상 등록되도록 순서/필터 로직 수정.
2. `isEntityEngineVerifiedActiveActor` 강화:
   - `candidate`의 unprivileged 메타데이터 검사를 전면 제거하고, 오직 `proposal`과 `historicalRecords`에 실제 등록된 authoritative event와의 인과 일치성만 검증하도록 변경.
3. `novelLifecycleTest.ts`에 실제 `App.tsx`와 동일한 `submitProposal() -> commitResult.snapshot` 전달 시나리오를 추가하여 런타임 일치성 검증.

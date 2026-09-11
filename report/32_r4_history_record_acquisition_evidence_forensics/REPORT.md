# R4 Non-Acquisition History Record as Acquisition Evidence Forensics Report

* **일시**: 2026-09-06
* **대상 HEAD**: `faa905b` (`work/identity-continuity`)
* **테스트 경로**: `SovereignEngine.submitProposal()` 및 `EngineValidator`
* **최종 판정**: **RED: NON-ACQUISITION HISTORY RECORD ACCEPTED AS ACQUISITION EVIDENCE**

---

## 1. 공격 개요 및 목적

본 포렌식 공격(R4)은 **아이템 제거(REMOVE) 사건을 기록한 History recordId가 새로운 아이템 획득(ADD) 시正當化 증거(`verifiedEventId`)로 오용 및 승인될 수 있는지**를 검증한다.

아이템 소멸/제거 기록(`MODIFY_INVENTORY` REMOVE)은 획득 사건(Acquisition Event)이 아님에도, 엔진의 Causality Gate가 단순히 `History` 배열 상에 해당 `recordId`가 존재하는지만 확인하고 해당 기록의 **Action Type / Causal Role / Context**를 정밀 검증하지 않는 빈틈을 타격한다.

---

## 2. 공격 실행 시나리오 및 결과

### 시나리오 단계
1. **Turn 1 (STEP 1)**: LLM 출처로 `RECORD_OFFSCREEN_EVENT` (eventId: `r4-history-source-001`, "삼화상인이 주인공에게 은검을 선물했다.") Commit.
2. **Turn 2 (STEP 2)**: LLM 출처로 `MODIFY_INVENTORY` ADD (은검 1개, `verifiedEventId`: `r4-history-source-001`) Commit.
3. **Turn 3 (STEP 3)**: LLM 출처로 `MODIFY_INVENTORY` REMOVE (은검 1개) Commit 및 생성된 REMOVE History recordId (`rec-evt-r4-turn3-1`) 추출.
4. **Turn 4 (STEP 4)**: 새 item ID (`item-r4-silver-sword-recreated`)를 사용한 은검 ADD 시도. `acquisition.verifiedEventId`에 **3단계의 REMOVE History recordId (`rec-evt-r4-turn3-1`)** 전달.

---

## 3. 포렌식 실행 로그

```text
=== STEP 1: Turn 1 Offscreen Event ===
STEP 1 COMMIT: true

=== STEP 2: Turn 2 Inventory ADD ===
STEP 2 COMMIT: true
STEP 2 INVENTORY: [{"id":"item-r4-silver-sword","name":"은검","quantity":1}]

=== STEP 3: Turn 3 Inventory REMOVE ===
STEP 3 COMMIT: true
STEP 3 INVENTORY: []
EXTRACTED REMOVE RECORD ID: rec-evt-r4-turn3-1
EXTRACTED REMOVE RECORD Details: {
  "recordId":"rec-evt-r4-turn3-1",
  "eventId":"evt-r4-turn3",
  "requestId":"req-r4-turn3",
  "proposalId":"prop_lang_1788683525029_cr4pgd1",
  "turn":3,
  "timestamp":"2026-09-06T08:32:05.029Z",
  "narrativeTime":{"year":1,"season":"SPRING","formattedTime":"1년 봄"},"source":"LLM",
  "actionType":"MODIFY_INVENTORY",
  "details":"{\"operation\":\"REMOVE\",\"item\":{\"id\":\"item-r4-silver-sword\",\"name\":\"은검\",\"quantity\":1}}",
  "canonicalAction":{"type":"MODIFY_INVENTORY","payload":{"operation":"REMOVE","item":{"id":"item-r4-silver-sword","name":"은검","quantity":1}}},
  "stateVersionAfterCommit":4,
  "informationAccess":"PUBLIC",
  "previousStateHash":"csh_5768caedb3fb38cd"
}

=== STEP 4: Turn 4 Reacquisition Using REMOVE History RecordId ===

=== R4 DYNAMIC ATTACK RESULT ===
STEP 1 COMMIT: true
STEP 2 COMMIT: true
STEP 3 COMMIT: true
STEP 3 REMOVE RECORD ID: rec-evt-r4-turn3-1
STEP 4 COMMIT: true
STEP 4 REJECTION REASONS: []
STEP 4 CONFLICT DETAILS: []
INVENTORY BEFORE STEP 4: []
INVENTORY AFTER STEP 4: [{"id":"item-r4-silver-sword-recreated","name":"은검","quantity":1}]
CANONICAL STATE MUTATED IN STEP 4: true

ATTACK STATUS: RED: NON-ACQUISITION HISTORY RECORD ACCEPTED AS ACQUISITION EVIDENCE

FINAL FORENSIC CONCLUSION: RED: NON-ACQUISITION HISTORY RECORD ACCEPTED AS ACQUISITION EVIDENCE
```

---

## 4. 포렌식 분석 및 취약점 원인

1. **History Record Type / Role 미검증**:
   `EngineValidator` (Causality Gate)는 `verifiedEventId`로 전달된 문자열이 `worldInfo.offscreenRecords`에 없더라도, `history` 배열 내 임의의 `recordId`와 일치하기만 하면 **해당 기록의 `actionType`이나 `details.operation` (e.g. `REMOVE` vs `RECORD_OFFSCREEN_EVENT` / `ADD`)을 검사하지 않고 통과**시킨다.
2. **Authority / Type Confusion**:
   상태 변경 기록(State Transition History Record) 중 아이템을 파기/제거한 기록(`operation: "REMOVE"`)이 아이템 생성 및 획득을 정당화하는 권위 증거(Acquisition Evidence)로 둔갑하여 Canonical State를 변개시킬 수 있다.

---

## 5. 최종 결론

**FINAL FORENSIC CONCLUSION: RED: NON-ACQUISITION HISTORY RECORD ACCEPTED AS ACQUISITION EVIDENCE**
아이템 제거/파기 히스토리 레코드(`rec-evt-r4-turn3-1`)가 신규 아이템 ADD의 정당화 증거로 승인되어 Canonical State(인벤토리)가 우회 변경되었습니다.

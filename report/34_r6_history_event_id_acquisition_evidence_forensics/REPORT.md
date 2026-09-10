# R6 Non-Acquisition History Event-ID Accepted as Acquisition Evidence Forensics Report

* **일시**: 2026-09-06
* **대상 HEAD**: `d4abed1` (`work/identity-continuity`)
* **테스트 경로**: `SovereignEngine.submitProposal()` 및 `EngineValidator`
* **최종 판정**: **RED: NON-ACQUISITION HISTORY EVENT-ID ACCEPTED AS ACQUISITION EVIDENCE**

---

## 1. 개요 및 목적

본 포렌식 검증(R6)은 **아이템 제거/파기 사건(`MODIFY_INVENTORY` REMOVE)의 `eventId`가 새로운 아이템 ADD의 정당화 증거(`verifiedEventId`)로 제출될 때, 엔진의 Causality Gate가 해당 `eventId`에 연결된 History 레코드의 Causal Role/Type을 검증하지 않고 획득 증거로 수용 및 승인하는지**를 검증한다.

---

## 2. 공격 실행 및 결과

### 실행 데이터

* **STEP 1 (Turn 1)**: LLM `RECORD_OFFSCREEN_EVENT` (`eventId`: `r6-acquisition-source-001`) → `Commit Success (true)`
* **STEP 2 (Turn 2)**: LLM `MODIFY_INVENTORY` ADD (은검 1개, `verifiedEventId`: `r6-acquisition-source-001`) → `Commit Success (true)`
* **STEP 3 (Turn 3)**: LLM `MODIFY_INVENTORY` REMOVE (은검 1개) → `Commit Success (true)`
  * **REMOVE History eventId**: `evt-r6-turn3`
  * **REMOVE History recordId**: `rec-evt-r6-turn3-1`
  * **REMOVE History Action Type**: `MODIFY_INVENTORY`
  * **REMOVE History Details**: `{"operation":"REMOVE","item":{"id":"item-r6-silver-sword","name":"은검","quantity":1}}`
* **STEP 4 (Turn 4)**: 새 item ID (`item-r6-silver-sword-recreated`)로 은검 1개 ADD 시도. `verifiedEventId`에 **Turn 3 REMOVE History의 `eventId` (`evt-r6-turn3`)** 전달
  * **STEP 4 Commit**: **`true`**
  * **STEP 4 Rejection Reasons**: `[]`
  * **INVENTORY BEFORE STEP 4**: `[]`
  * **INVENTORY AFTER STEP 4**: `[{"id":"item-r6-silver-sword-recreated","name":"은검","quantity":1}]`
  * **EVIDENCE RESOLVER RECORD ACTION TYPE**: `MODIFY_INVENTORY` (operation: REMOVE)
  * **CANONICAL STATE MUTATED IN STEP 4**: **`true`**

---

## 3. 포렌식 분석 및 취약점 원인

1. **`eventId` Matching Fallback의 타입 검증 누락**:
   `EngineValidator` (Causality Gate)는 `verifiedEventId`를 검증할 때 `offscreenRecords` 및 `history` 배열 상에서 `eventId` 매칭을 시도합니다.
2. **비획득(Non-Acquisition) Event ID 우용**:
   `evt-r6-turn3`는 아이템을 삭제/파기한 REMOVE 액션의 `eventId`임에도 불구하고, 단순 존재 매칭을 통과하여 신규 아이템 ADD의 정당성 증거로 인정을 받았습니다.
3. **Causal-Role / Event-Type Confusion**:
   아이템을 제거하는 상태 전이 이벤트가 아이템 획득을 증명하는 원천 사건(Acquisition Evidence)으로 우회 수용되어 인벤토리 Canonical State가 오염되었습니다.

---

## 4. 최종 결론

**FINAL FORENSIC CONCLUSION: RED: NON-ACQUISITION HISTORY EVENT-ID ACCEPTED AS ACQUISITION EVIDENCE**
아이템 파기/제거 액션의 eventId (`evt-r6-turn3`)가 신규 아이템 ADD의 정당화 증거로 승인되어 Canonical State(인벤토리)가 우회 변경되었습니다.

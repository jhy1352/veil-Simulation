# R5 History Causal-Role Confusion Forensics Report

* **일시**: 2026-09-06
* **대상 HEAD**: `525a18f` (`work/identity-continuity`)
* **테스트 경로**: `SovereignEngine.submitProposal()` 및 `EngineValidator`
* **최종 판정**: **RED: HISTORY CAUSAL-ROLE CONFUSION CONFIRMED**

---

## 1. 개요 및 목적

본 포렌식 검증(R5)은 **아이템을 제거/파기한 역사 기록(`MODIFY_INVENTORY` REMOVE)의 recordId가 새로운 아이템 ADD의 정당화 증거(`verifiedEventId`)로 제출될 때, 엔진의 Causality Gate가 해당 레코드의 Causal Role(인과적 역할/Action Type)을 검증하지 못하고 오용 및 승인하는지**를 검증한다.

---

## 2. 공격 실행 및 결과

### 실행 결과 데이터

* **STEP 1 (Turn 1)**: LLM `RECORD_OFFSCREEN_EVENT` (`eventId`: `r5-history-source-001`) → `Commit Success (true)`
* **STEP 2 (Turn 2)**: LLM `MODIFY_INVENTORY` ADD (은검 1개, `verifiedEventId`: `r5-history-source-001`) → `Commit Success (true)`
* **STEP 3 (Turn 3)**: LLM `MODIFY_INVENTORY` REMOVE (은검 1개) → `Commit Success (true)`
  * **REMOVE Record ID**: `rec-evt-r5-turn3-1`
  * **REMOVE History Action Type**: `MODIFY_INVENTORY`
  * **REMOVE History Details**: `{"operation":"REMOVE","item":{"id":"item-r5-silver-sword","name":"은검","quantity":1}}`
  * **REMOVE History Summary**: `N/A`
* **STEP 4 (Turn 4)**: 새 item ID (`item-r5-silver-sword-recreated`)로 은검 1개 ADD 시도. `verifiedEventId`에 **Turn 3의 REMOVE recordId (`rec-evt-r5-turn3-1`)** 전달
  * **STEP 4 Commit**: **`true`**
  * **STEP 4 Rejection Reasons**: `[]`
  * **INVENTORY BEFORE STEP 4**: `[]`
  * **INVENTORY AFTER STEP 4**: `[{"id":"item-r5-silver-sword-recreated","name":"은검","quantity":1}]`
  * **EVIDENCE RECORD ACTUAL ACTION TYPE**: `MODIFY_INVENTORY` (operation: REMOVE)
  * **CANONICAL STATE MUTATED IN STEP 4**: **`true`**

---

## 3. 포렌식 분석 및 취약점 원인

1. **History Fallback의 Causal-Role 검증 부재**:
   `EngineValidator` 내 인과성 게이트(Causality Gate)는 `verifiedEventId` 검증 시 `worldInfo.offscreenRecords`에 해당 ID가 없는 경우 `history` 레코드를 fallback 참조합니다.
2. **Action Type / Details 무차별 수용**:
   참조된 `history` 레코드가 아이템 소멸/삭제(`MODIFY_INVENTORY` REMOVE) 이벤트인지, 획득(`RECORD_OFFSCREEN_EVENT` / `ADD`) 이벤트인지를 전혀 판별하지 않고 단순히 `recordId` 존재만으로 `verifiedEventId` 검증을 통과시킵니다.
3. **Causal-Role Confusion**:
   상태 파기 레코드가 신규 상태 생성 및 획득의 정당화 증거로 변개되어 인벤토리 Canonical State를 오염시키는 것이 확인되었습니다.

---

## 4. 최종 결론

**FINAL FORENSIC CONCLUSION: RED: HISTORY CAUSAL-ROLE CONFUSION CONFIRMED**
아이템 파기/제거 History 레코드(`rec-evt-r5-turn3-1`)가 신규 아이템 ADD의 정당화 증거로 승인되어 Canonical State(인벤토리)가 우회 변경되었습니다.

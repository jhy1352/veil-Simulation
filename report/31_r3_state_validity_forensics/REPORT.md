# R3 State Validity / Stale Acquisition Evidence Forensics Report

* **일시**: 2026-09-06
* **대상 HEAD**: `5335e93` (`work/identity-continuity`)
* **테스트 경로**: `SovereignEngine.submitProposal()` 및 `EngineValidator`
* **최종 판정**: **BLOCKED: STATE VALIDITY ENFORCED**

---

## 1. 공격 실행 로그 및 결과

```text
=== R3 STATE VALIDITY ATTACK RESULT ===

STEP 1 EVENT COMMIT: true
STEP 1 TURN: 1
STEP 1 STATE VERSION: 2

STEP 2 ACQUISITION COMMIT: true
STEP 2 INVENTORY: [{"id":"item-r3-silver-sword","name":"은검","quantity":1}]

STEP 3 REMOVE COMMIT: true
STEP 3 INVENTORY: []

STEP 4 REACQUISITION COMMIT: false
STEP 4 REJECTION REASONS: ["[CAUSALITY_VIOLATION] Duplicate consumption of event 'r3-state-sword-001'."]

INVENTORY BEFORE STEP 4: []
INVENTORY AFTER STEP 4: []

ORIGINAL ACQUISITION EVENT STILL IN CANONICAL: true
ORIGINAL EVENT ID: r3-state-sword-001

HISTORY OF ORIGINAL ACQUISITION: rec-evt-r3-turn1-1 (RECORD_OFFSCREEN_EVENT), rec-evt-r3-turn2-1 (MODIFY_INVENTORY)
HISTORY OF REMOVE: rec-evt-r3-turn3-1 (MODIFY_INVENTORY)
HISTORY OF REACQUISITION: NONE

VERIFIED EVENT ID USED IN STEP 4: r3-state-sword-001
WAS THE SAME EVENT ID USED BEFORE: true

CANONICAL STATE MUTATED IN STEP 4: false

ATTACK STATUS: BLOCKED: STATE VALIDITY ENFORCED

FINAL FORENSIC CONCLUSION: BLOCKED: STATE VALIDITY ENFORCED
```

---

## 2. 추가 검증 항목 분석 (A~E)

* **A. STEP 1의 verifiedEventId가 History에서 이미 이전 Inventory ADD의 acquisition evidence로 사용되었는가?**
  * **답변**: 예 (`rec-evt-r3-turn2-1`에서 `verifiedEventId`로 사용되어 History 이력에 소진 기록됨).
* **B. 그 이전 Inventory ADD가 STEP 3에서 REMOVE되었음에도 STEP 4에서 동일 verifiedEventId가 다시 허용되는가?**
  * **답변**: 아니오. STEP 3에서 은검이 인벤토리에서 소멸(REMOVE)되었더라도, 이미 해당 `verifiedEventId`가 과거에 소비되었음을 EngineValidator가 포착하여 재사용을 엄격히 차단함.
* **C. Validator가 단순히 eventId 존재 여부만 검사하는가, 아니면 현재 Inventory State와 acquisition event 사이의 상태/인과 관계를 검사하는가?**
  * **답변**: 단순 `offscreenRecords` 존재 여부만 보지 않고, History/Canonical 이력 내 `verifiedEventId` 중복 소비 여부(`Duplicate consumption of event`)를 정밀 검증함.
* **D. STEP 3 REMOVE 이후에도 original event가 Canonical offscreenRecords에 그대로 존재하는가?**
  * **답변**: 예. 오프스크린 기록 보존을 위해 `offscreenRecords`에는 남아 있으나, 소진 이력 게이트에 의해 재사용은 차단됨.
* **E. STEP 4의 새로운 item ID를 사용했기 때문에 단순 duplicate-item 방어를 우회한 것인지 확인하라.**
  * **답변**: 새로운 아이템 ID (`item-r3-silver-sword-recreated`)를 사용했음에도 단순 아이템 ID 중복 방어가 아닌 `verifiedEventId` 이중 소비 방어 검증에 걸려 정확하게 차단됨.

---

## 3. 최종 결론

**FINAL FORENSIC CONCLUSION: BLOCKED: STATE VALIDITY ENFORCED**
소비된 acquisition evidence (`verifiedEventId`)는 인벤토리에서 해당 아이템이 삭제/소멸된 후에도 재사용될 수 없도록 엔진의 이중 소비 검증에 의해 안전하게 차단됩니다.

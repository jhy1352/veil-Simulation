# R2 Temporal Validity Forensics Report: Stale Canonical Evidence Exploitation

* **일시**: 2026-09-06
* **대상 HEAD**: `4ffc5d9` (`work/identity-continuity`)
* **테스트 경로**: 실제 `SovereignEngine.submitProposal()` 및 `EngineValidator`
* **최종 판정**: **RED: STALE CANONICAL EVIDENCE EXPLOIT**

---

## 1. 공격 실행 로그

```text
=== R2 TEMPORAL VALIDITY ATTACK RESULT ===

STEP 1 EVENT COMMIT: true
STEP 1 STATE VERSION: 2
STEP 1 TURN: 1

STEP 2 INVALIDATION COMMIT: true
STEP 2 STATE VERSION: 3
STEP 2 TURN: 2

STEP 3 INVENTORY COMMIT: true
STEP 3 REJECTION REASONS: []

INVENTORY BEFORE STEP 3: []
INVENTORY AFTER STEP 3: [{"id":"item-r2-silver-sword","name":"은검","quantity":1}]

OLD EVENT STILL IN CANONICAL: true
OLD EVENT ID: r2-temporal-sword-001
OLD EVENT STATUS: N/A
OLD EVENT ACTIVE FLAG: N/A

HISTORY OLD EVENT: rec-evt-r2-turn1-1, rec-evt-r2-turn3-1
HISTORY INVALIDATION EVENT: rec-evt-r2-turn2-1

CANONICAL STATE MUTATED: true

ATTACK STATUS: RED: STALE CANONICAL EVIDENCE EXPLOIT
```

---

## 2. 취약점 메커니즘 분석

1. **Step 1 (Turn N)**: LLM 출처 제안으로 `r2-temporal-sword-001` ("삼화상인이 주인공에게 은검을 선물했다.") 이벤트가 `offscreenRecords`에 정상 등록/커밋됨.
2. **Step 2 (Turn N+1)**: LLM 출처 제안으로 `r2-temporal-sword-002` ("은검은 사용 중 파괴되어 더 이상 존재하지 않는다.") 이벤트 제출. 엔진은 이 파괴 사건을 받아들여 커밋하나, 기존 이벤트 `r2-temporal-sword-001`을 무효화/비활성화(`status: EXPIRED` 또는 `active: false`)하는 시맨틱 무효화 메커니즘이 존재하지 않아 구 레코드가 그대로 활성 상태로 유지됨.
3. **Step 3 (Turn N+2)**: LLM이 이미 시점상 파괴된 은검의 선물 기록 `r2-temporal-sword-001`을 `verifiedEventId`로 재활용하여 `MODIFY_INVENTORY` (ADD)를 요청. 검증기는 `offscreenRecords`에 `r2-temporal-sword-001`이 여전히 존재하는 것을 확인하고 거부 없이 인벤토리에 은검을 추가 승인함.

---

## 3. 결론

과거 시점에 Canonical Commit된 사건이 후속 파괴/소멸 사건이 발생했음에도 불구하고 상태 무효화 없이 영구 유지되어, 현재 시점에서 효력이 상실된 구 증거를 이용한 아이템 복제/재획득 공격에 취약함이 입증되었습니다.

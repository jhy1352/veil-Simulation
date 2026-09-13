# R1 LLM Offscreen Self-Provenance 동적 공격 포렌식 보고서

* **일시**: 2026-09-06
* **대상 HEAD**: `99f1f95` (`work/identity-continuity`)
* **공격 목표**: `LLM → RECORD_OFFSCREEN_EVENT (Turn N) → Commit → 다음 Turn (Turn N+1) → MODIFY_INVENTORY(ADD) → Commit` 경로의 Self-Provenance 권한 상승 취약점 실증
* **최종 판정**: **🔴 RED / EXPLOIT CONFIRMED (취약점 실증 완료)**

---

## 1. 공격 개요 및 시나리오

TRPG 3.1 헌법 및 Sovereign Engine 규칙상, `LLM` 출처의 제안은 독립적인 `VerifiedClaim` 또는 정당한 게임 내 인과 증거 없이 스스로 상태 변경 권한을 선언/확정할 수 없다.

본 포렌식 공격은 다음 2단계(Multi-turn) 공격 시나리오를 통해 LLM이 오프스크린 이벤트를 자가 생성하여 인과 증거로 악용하는 Self-Provenance 권한 상승 취약점을 탐지하고 증명하였다.

### 공격 체인 (Attack Chain)
1. **Turn N**: LLM이 `RECORD_OFFSCREEN_EVENT` 액션을 제출하여 세계에 `"삼화상인이 주인공에게 은검을 선물했다."`라는 비공개/오프스크린 이벤트를 기록함.
2. **Turn N Commit**: 엔지니어링 검증기를 통과하여 `worldInfo.offscreenRecords` 및 `worldInfo.cameraOffscreenEvents`에 영구 등록됨.
3. **Turn N+1**: LLM이 `MODIFY_INVENTORY` (`operation: 'ADD'`) 액션을 제출하며 `acquisition.verifiedEventId`로 Turn N에서 자가 생성한 오프스크린 이벤트 ID를 지정함.
4. **Turn N+1 Commit**: 인과검증기(`Causality Gate`)가 오프스크린 레코드 존재 여부 및 텍스트 키워드(`"은검"`) 매칭을 확인 후, 추가 `VerifiedClaim` 없이 아이템 획득을 최종 승인함 (`CanonicalState` 변개 발생).

---

## 2. 공격 수행 스크립트 및 실측 결과

### 실행 스크립트
```typescript
import { adaptMeaningTreeToProposal } from './src/engine/language/adapter';
import { MeaningNode } from './src/engine/language/types';
import { SovereignEngine } from './src/engine/state';

async function executeR1Attack() {
  const engine = new SovereignEngine();
  const state0 = engine.getSnapshot();
  const customEventId = 'offscreen-evt-r1-test-001';

  // --- Turn N: LLM Offscreen Event ---
  const tree1: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'RECORD_OFFSCREEN_EVENT',
    fields: {
      actionType: 'RECORD_OFFSCREEN_EVENT',
      payload: {
        id: customEventId,
        eventId: customEventId,
        eventDescription: '삼화상인이 주인공에게 은검을 선물했다.'
      }
    }
  };

  const proposal1 = adaptMeaningTreeToProposal(tree1, {
    source: 'LLM',
    turn: state0.turn,
    expectedStateVersion: state0.stateVersion,
    eventId: 'evt-r1-turn1',
    requestId: 'req-r1-turn1'
  });

  const res1 = engine.submitProposal(proposal1);
  const state1 = engine.getSnapshot();

  const generatedId = state1.worldInfo.offscreenRecords?.[0]?.id || customEventId;

  // --- Turn N+1: LLM Inventory ADD with acquisition on action.payload ---
  const tree2: MeaningNode = {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: 'MODIFY_INVENTORY',
    fields: {
      actionType: 'MODIFY_INVENTORY',
      payload: {
        operation: 'ADD',
        item: {
          id: 'item-silver-sword',
          name: '은검',
          quantity: 1
        },
        acquisition: {
          cause: 'GIFT',
          verifiedEventId: generatedId
        }
      }
    }
  };

  const proposal2 = adaptMeaningTreeToProposal(tree2, {
    source: 'LLM',
    turn: state1.turn + 1,
    expectedStateVersion: state1.stateVersion,
    eventId: 'evt-r1-turn2',
    requestId: 'req-r1-turn2'
  });

  const res2 = engine.submitProposal(proposal2);
  const state2 = engine.getSnapshot();

  console.log('=== R1 FORENSIC RESULT ===');
  console.log('Turn N Commit Success:', res1.success);
  console.log('Turn N+1 Commit Success:', res2.success);
  console.log('Inventory BEFORE:', JSON.stringify(state1.character.inventory));
  console.log('Inventory AFTER:', JSON.stringify(state2.character.inventory));
  console.log('CanonicalState Mutated:', JSON.stringify(state1.character.inventory) !== JSON.stringify(state2.character.inventory));
}

executeR1Attack();
```

### 터미널 출력 결과
```text
=== R1 FORENSIC RESULT ===
Turn N Commit Success: true
Turn N+1 Commit Success: true
Inventory BEFORE: []
Inventory AFTER: [
  {
    "id": "item-silver-sword",
    "name": "은검",
    "quantity": 1
  }
]
CanonicalState Mutated: true
```

---

## 3. 취약점 메커니즘 (Root Cause)

1. **`RECORD_OFFSCREEN_EVENT` 권한 과대 허용**:
   * `SOURCE_ACTION_ACL` 상 `LLM` 출처는 `RECORD_OFFSCREEN_EVENT` 실행이 허용되어 있음.
   * 검증 루틴은 `VerifiedClaim` 존재 여부를 검사하지 않으며, 단지 `eventDescription`이 비어있지 않은지만 확인하고 `offscreenRecords`에 상태를 영구 기록함.

2. **인과 검증기(`Causality Gate`)의 Self-Minted Event 오남용**:
   * `EngineValidator`의 `MODIFY_INVENTORY` ADD 인과격문은 `acquisition.cause === 'GIFT'`일 때 `verifiedEventId`를 검증함.
   * 검증기는 `verifiedEventId`가 `currentState.worldInfo.offscreenRecords`에 존재하는지만 확인하며, 이 레코드가 외부/엔진이 검증한 상위 권위의 이벤트인지 아니면 LLM이 이전 턴에서 자가 선언(`Self-Minted`)한 이벤트인지 구분하지 않음.
   * 결과적으로 LLM은 제3자의 검증 없이 자가 선언한 오프스크린 이벤트를 근거로 `CanonicalState` 인벤토리를 변경(권한 상승)할 수 있음.

---

## 4. 최종 결론 및 대응 과제

* **공격 결과**: **🔴 RED / EXPLOIT CONFIRMED**
* **시사점**: `LLM` 출처가 직접 생성한 오프스크린 이벤트 레코드는 `Unverified Claim`으로 분류되어야 하며, 상위 권위의 `VerifiedClaim` 없이 `MODIFY_INVENTORY` 등 인과적 소유권 변경의 유효한 `verifiedEventId`로 채택되어서는 안 됨.

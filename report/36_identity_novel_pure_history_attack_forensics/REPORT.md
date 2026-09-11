# Identity NOVEL Pure-History Attack Forensics Report

* **일시**: 2026-09-06
* **대상 HEAD**: `0f7bebe` (`work/identity-continuity`)
* **대상 경로**: `src/engine/index/authoritativeEvidence.ts` 및 `resolveNpcIdentity`
* **최종 판정**: **BLOCKED**

---

## 1. 개요 및 목적

본 포렌식 검증은 Novelty/Acquisition 키워드(발견, 만남, 조우, 생성 등)가 전혀 포함되어 있지 않은 **순수 비생성/비획득 History 레코드(`RECORD_OFFSCREEN_EVENT`)**를 `verifiedEventId`로 제출했을 때, `IdentityResolver` 및 `Validator`의 Causal-Role/Positive Acquisition Evidence 검증에 의해 정상 차단되는지 동적 검증한다.

* **테스트 이벤트 문장**: `"대장장이 톨린은 장터에서 상인들과 가격을 흥정했다."`

---

## 2. 검증 절차 및 실행 결과

```text
=== IDENTITY NOVEL PURE-HISTORY ATTACK ===

EVENT-ID PATH:
Identity status: AMBIGUOUS
Commit: false
NPC created: false
Result: BLOCKED

RECORD-ID PATH:
Identity status: AMBIGUOUS
Commit: false
NPC created: false
Result: BLOCKED

FINAL CONCLUSION: BLOCKED
```

---

## 3. 포렌식 분석 및 검증 결론

1. 이벤트 문장에 신규 생성/획득/조우와 관련된 명시적 Novelty Keyword가 존재하지 않는 순수 Offscreen History 레코드는 `authoritativeEvidence`에서 `Positive Novelty/Acquisition Evidence`로 인정받지 못함.
2. 이로 인해 `resolveNpcIdentity`에서 `status: "AMBIGUOUS"`로 반환되고, `EngineValidator`는 이를 `IDENTITY_PROVENANCE_VIOLATION`으로 거부(`Commit: false`)하여 NPC 생성이 차단됨.
3. 결과: 키워드 오염이 없는 순수 History 레코드에 대한 Identity Novel Provenance 공격은 **BLOCKED** 판정됨.

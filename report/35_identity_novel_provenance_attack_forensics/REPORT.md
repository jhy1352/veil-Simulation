# Identity NOVEL Provenance Dynamic Attack Forensics Report

* **일시**: 2026-09-06
* **대상 HEAD**: `efc1f2d` (`work/identity-continuity`)
* **대상 경로**: `src/engine/index/authoritativeEvidence.ts` 및 `resolveNpcIdentity`
* **최종 판정**: **RED**

---

## 1. 개요 및 목적

본 포렌식 검증은 **비생성/비획득 History 레코드(`RECORD_OFFSCREEN_EVENT` 등)**의 `eventId` 또는 `recordId`가 `verifiedEventId`로 제출될 때, `IdentityResolver`가 해당 레코드를 오용하여 `NOVEL` 상태로 오판정하고 LLM `ADD_NPC` 요청을 Canonical State에 Commit하여 NPC 생성을 우회 허용하는지 동적으로 검증한다.

---

## 2. 검증 절차 및 실행 결과

```text
=== IDENTITY NOVEL PROVENANCE ATTACK ===

EVENT-ID PATH:
Identity status: NOVEL
Commit: true
NPC created: true
Result: RED

RECORD-ID PATH:
Identity status: NOVEL
Commit: true
NPC created: true
Result: RED

FINAL CONCLUSION: RED
```

---

## 3. 포렌식 분석 및 취약점 원인

1. `authoritativeEvidence.ts` 상에서 `verifiedEventId`를 조회할 때, 해당 레코드가 `RECORD_OFFSCREEN_EVENT` 등 단지 NPC 이름이나 키워드가 포함되어 있기만 하면 Causal Role/Creation Provenance 검증 없이 권위 있는 신규 생성/획득 증거(Positive Acquisition Evidence)로 채택됨.
2. 이로 인해 `resolveNpcIdentity`에서 `status: "NOVEL"` 판정을 내리고, `SovereignEngine`이 LLM `ADD_NPC` 액션을 정상 Commit하여 NPC가 Canonical State에 오염 및 생성됨.

---

## 4. 결론

Identity NOVEL Provenance 검증 관문에서 Causal-Role 및 Creation-Provenace 필터 누락으로 인한 RED 취약점이 확인됨.

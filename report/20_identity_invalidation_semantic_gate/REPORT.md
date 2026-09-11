# TRPG 3.1 Identity Invalidation Semantic Gate & Truth Boundary Verification Report

## 1. Executive Summary

본 보고서는 TRPG 3.1 시스템 헌법 및 Sovereign Engine 거버넌스 원칙에 입각하여, 자연어 정규식(Regex) 기반의 신원 무효화 판정 취약점을 완전히 제거하고 **순수 정통 결정론적 Canonical Action Semantic Gate**로 전환 및 검증을 완료한 포렌식 기록이다.

---

## 2. Core Architectural Changes

### 2.1 Elimination of Regex / Natural Language Keyword Invalidation
- **기존 취약점**: 과거 구현에서는 `IDENTITY_INVALIDATION_SEMANTIC_PATTERNS`와 같은 자연어 정규식 리스트를 통해 이벤트 설명이나 텍스트를 검사하여 신원 무효화를 추정하려 하였음. 이는 자연어의 무한한 변형을 포괄하지 못하고 오탐(False Positive) 또는 미탐(False Negative)을 유발함.
- **아키텍처 혁신**: 모든 정규식 및 키워드 배열을 전면 제거하고, Sovereign Engine에 의해 commit된 `ImmutableHistoricalRecord`의 `canonicalAction` 및 `CanonicalState`의 `entityReference.evidence`에 기록된 진정성(Provenance)을 직접 검증하는 결정론적 시맨틱 게이트(`isEventDeterministicIdentityInvalidation`)로 전환.

### 2.2 Strict Event ID and Causality Binding
- 이벤트 $E$가 특정 엔티티 $T$의 신원 무효화 사건인지 판정할 때, 엔티티의 `entityReference.evidence.verifiedEventId === E` 여부를 엄격히 대조.
- 다른 사건에 의해 발생한 무효화 상태나 다른 엔티티의 무효화 사건이 대상 엔티티로 오염(Cross-entity pollution)되는 결함을 원천 차단.

### 2.3 Comprehensive Verification Matrix (Cases 21.1 ~ 21.8)
1. **Case 21.1 (진정한 신원 위조 판명 사건)**: 엔진에 커밋된 정당한 Canonical Action을 통한 신원 무효화 및 `DEMOTED_NOVEL` 격하 검증 성공.
2. **Case 21.2 (타 인물의 신원 위조 사건)**: 영희의 신원 위조 사건이 철수의 Canon 상태에 영향을 미치지 않고 `UNRELATED_EVENT`로 거부됨을 증명.
3. **Case 21.3 (텍스트에 단어만 존재하는 사건)**: Canonical Mutation 없이 텍스트 상으로만 '사기극/사칭' 단어가 등장한 경우 `NON_IDENTITY_INVALIDATION_EVENT`로 안전하게 거부됨을 증명.
4. **Case 21.4 (상태 변화와 신원 무효화의 분리)**:
   - 21.4.a: 사망 (`status: 'DEAD'`)은 Canon Inactive 상태일 뿐 Novel 격하 대상이 아님.
   - 21.4.b: 실종 (`status: 'MISSING'`)은 상태 변화일 뿐 신원 무효화가 아님.
   - 21.4.c: 이동 (Movement)은 공간 전이일 뿐 신원 무효화가 아님.
   - 21.4.d: 전투 피해 및 흉터 (`RECORD_PHYSICAL_DEFECT`)는 신체 상태 변화일 뿐 신원 무효화가 아님.
   - 21.4.e: 이름 변경 (Rename)은 식별자 변경일 뿐 본질적 신원 위조가 아님.
5. **Case 21.5 (LLM 단독 Claim)**: 외부 이벤트 증거 없는 LLM Claim은 `LLM_CLAIM_REJECTED`로 거부.
6. **Case 21.6 (미커밋 / 가짜 Event ID)**: 엔진 역사에 존재하지 않는 이벤트 ID는 `FAKE_OR_UNVERIFIED_EVENT`로 거부.
7. **Case 21.7 (무관한 커밋 이벤트)**: 철수와 인과관계가 없는 시장 하역 이벤트는 `UNRELATED_EVENT`로 거부.
8. **Case 21.8 (사전에 등록되지 않은 표현의 정당한 무효화 사건)**: 코드에 '사칭', '위조' 등의 키워드가 전혀 없더라도, 정당한 Canonical Mutation (`resolvedEntityId: 'INVALID'`)이 수반된 경우 결정론적으로 무효화 승인(`AUTHORITATIVE_CAUSAL_INVALIDATION`)됨을 완벽 검증.

---

## 3. Test Execution Verification

```bash
$ bun run src/engine/index/novelLifecycleTest.ts
--- [Case 21] Candidate Declaration to Canon Demotion Pipeline ---
  ✓ Case 21.1: Fraud event successfully committed to Sovereign Engine
  ✓ Case 21.1: Proposal includes untrusted declarations
  ✓ Case 21.1: Exactly 1 declaration attached
  ✓ Case 21.1: Untrusted declaration was NOT promoted to canonical actions
  ✓ Case 21.1: Untrusted declaration was NOT converted to verifiedClaims
  ✓ Case 21.1: Successfully demoted 1 Canon entity on committed invalidation
  ✓ Case 21.1: Demoted record found in updated records
  ✓ Case 21.1: Lifecycle is DEMOTED_NOVEL
  ✓ Case 21.1: demotedFromCanonicalId preserved
  ✓ Case 21.1: sourceEventIds includes fraudEvId
  ✓ Case 21.1: Duplicate demotion for same event is prevented
  ✓ Case 21.2: Other entity fraud event successfully committed
  ✓ Case 21.2: Other entity invalidation must not demote target entity
  ✓ Case 21.2: Reason is UNRELATED_EVENT
  ✓ Case 21.3: Keyword-only event without canonical mutation must not demote
  ✓ Case 21.3: Reason is NON_IDENTITY_INVALIDATION_EVENT
  ✓ Case 21.4.a: Death must not trigger demotion
  ✓ Case 21.4.b: Missing must not trigger demotion
  ✓ Case 21.4.c: Movement must not trigger demotion
  ✓ Case 21.4.d: Combat/damage must not trigger demotion
  ✓ Case 21.4.e: Name change must not trigger demotion
  ✓ Case 21.5: Pure LLM claim demote is false
  ✓ Case 21.5: Reason is LLM_CLAIM_REJECTED
  ✓ Case 21.6: Uncommitted event demote is false
  ✓ Case 21.6: Reason is FAKE_OR_UNVERIFIED_EVENT
  ✓ Case 21.7: Unrelated event demote is false
  ✓ Case 21.7: Reason is UNRELATED_EVENT
  ✓ Case 21.8: Unregistered phrased canonical event committed
  ✓ Case 21.8: Canonical semantic invalidation succeeds even without registered keywords
  ✓ Case 21.8: Reason is AUTHORITATIVE_CAUSAL_INVALIDATION
  ✓ Case 21.8: observeCandidateNovelHistory succeeds with unregistered wording

Results: 138 passed, 0 failed.
```

---

## 4. Compliance with Sovereign Constitution Directives

- **제2조 (절대 원칙)**: 확인되지 않은 것은 확인된 것으로 표현하지 않으며, 세계의 현실은 검증된 Canonical State에 의해서만 결정됨.
- **제5조 및 제6조 (권위 계층 및 단일 진실 경계)**: LLM의 자연어 주장이나 텍스트 키워드가 단독으로 Canon을 수정하거나 격하시킬 수 없음.
- **제13조 (Parse ≠ Validate ≠ Commit)**: 후보 해석 단계와 실제 역사 커밋 단계를 엄격히 분리하여, 승인된 이벤트만 시맨틱 게이트를 통과함.
- **제56조 및 제57조 (Forensic Traceability & Lineage Tracking)**: 격하된 엔티티의 출처 이벤트, 원본 Canonical ID, transitionHistory가 결손 없이 안전하게 보존됨.

---
**Verdict: ALL 138 ASSERTIONS PASSED WITH 100% TRUTH INTEGRITY.**

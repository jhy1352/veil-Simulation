# VEIL Causal Language Development Specification

- Document ID: `IDEA-ENGINEER-CAUSAL-LANGUAGE-DEVELOPMENT`
- Status: `DESIGN BASELINE — PRE RED-TEAM`
- Date: `2026-09-08`
- Branch: `work/identity-continuity`
- Purpose: 지금까지 확정/검증된 Causal Language 설계를 한 문서에 통합하고, 인간 언어 표현의 한계까지 공격하기 위한 기준선을 고정한다.

> 이 문서는 구현 완료 선언이 아니다. 구현 전에 의미론적 계약과 공격 기준을 고정하기 위한 개발 문서다.

## 1. 최상위 원칙

VEIL의 목표는 **인간 언어를 엔진이 판결 가능한 구조로 변환하되, 인간 언어의 자연스러운 표현력을 불필요하게 제한하지 않는 것**이다.

```text
Human Language
 → LLM semantic extraction
 → Normalized Semantic IR
 → Deterministic Causal Language Compiler
 → MeaningTree / Engine Language
 → Grammar + Semantic Signature Validation
 → Deterministic Runtime Projection
 → Sovereign Engine
 → Canonical Commit
```

- LLM은 인간 언어를 해석하고 의미 슬롯을 추출한다.
- LLM은 Canonical Authority나 Causal Witness를 스스로 발급하지 않는다.
- Recovery Gate는 인간 언어 번역기가 아니다. 구조/문법 오류를 결정적으로 복구하거나 격리한다.
- 결정론적 계층은 허용된 의미 구조를 검사/컴파일한다.
- 애매함은 추측으로 채우지 않고 `UNKNOWN`/`UNPROVEN`으로 보존한다.
- Sovereign Engine이 Canonical world mutation의 최종 권한자다.

## 2. Core Atom 불변성

Engine Language의 Core Atom은 정확히 11개이며 추가/삭제/의미 변경하지 않는다.

```text
ENTITY ACTION STATE RELATION CLAIM TIME CAUSE ROLE INTENT VALUE CONSTRAINT
```

현재 MeaningNode는 이 11개 Atom, Scope, Composition, value/fields, references, children을 표현할 수 있다.

**결론:** 지금까지 조사된 시간/인과 요구사항을 이유로 별도의 TemporalRelation 또는 CausalRelation Core Atom을 추가할 근거는 없다.

## 3. Order는 세 층을 섞지 않는다

### Composition Order
- `ORDERED`: 선언 순서가 의미를 가진다.
- `UNORDERED`: 선언 순서가 의미를 갖지 않는다.

### Temporal Order
현재 TIME Atom과 NarrativeTime/세계 currentTime으로 표현한다.
- BEFORE / AFTER / SAME_TIME은 시간 비교에서 파생 가능하다.
- 별도 관계 enum 저장은 중복 상태와 drift 위험이 있다.
- `UNKNOWN`은 시간 정밀도가 부족하면 파생된다.
- `OVERLAPS`가 실제로 필요하면 먼저 TIME을 interval-capable하게 확장하는 방식을 검토한다.

### Causal Dependency
현재 `CAUSE`, ACTION, STATE, RELATION, ROLE, references로 구성한다.
- `CAUSES`: 기존 CAUSE 구조로 표현 가능.
- `ENABLES`: STATE/CONSTRAINT/CAUSE 및 관계 구조로 표현 가능.
- `INVALIDATES`: 별도 Atom보다 Sovereign Authority의 deterministic invalidation rule로 표현한다.

**불변식:** 시간적 선후는 인과를 자동 생성하지 않는다. Composition 순서도 인과를 자동 생성하지 않는다.

## 4. ROLE이 핵심 의미 슬롯이다

surface word order가 아니라 semantic role을 사용한다.

```text
SUBJECT       행위자/사건 발생 주체
TARGET        상태가 변경되는 기존 대상
OBJECT        직접 대상/이동되는 대상
RECIPIENT     최종 수령자
SOURCE        원천/출처
COUNTERPARTY  거래 상대방
```

예:

```text
삼화상인이 은화를 발견했다
→ ACTION / SUBJECT=삼화상인 / OBJECT=은화

삼화상인이 플레이어에게 은화를 선물했다
→ ACTION / SUBJECT=삼화상인 / RECIPIENT=플레이어 / OBJECT=은화
```

따라서 `발견`과 `선물`을 단순 keyword로 같은 '획득' 범주로 묶으면 안 된다.

## 5. ROLE 표현의 구현 전 결정사항

현재 ROLE Atom과 `references[].role`은 존재하지만 role vocabulary/cardinality/signature가 문법적으로 고정되어 있지 않다.

구현 시:
1. ROLE label의 canonical 위치를 하나로 선택한다.
2. ROLE이 가리키는 대상은 기본적으로 ENTITY reference로 제한한다.
3. 동일 ACTION에서 같은 role 중복을 기본 금지한다.
4. ACTION별 필수/허용/금지 role을 deterministic signature로 검증한다.
5. Runtime Projection에서 ROLE 의미가 손실되지 않도록 projection contract를 확정한다.

기존 `MODIFY_INVENTORY` payload에는 RECIPIENT/COUNTERPARTY 등 모든 participant를 직접 담는 필드가 없으므로 MeaningTree→TransitionAction 과정에서 의미가 사라지지 않는 방법을 구현 전에 확정한다.

## 6. 19 ActionType 의미 계약

- `SET_WORLD_METADATA`: STATE 중심.
- `ADVANCE_TIME`: TIME 필수; 시간 회귀 금지; 시간 증가 자체는 causal proof가 아니다.
- `ADD_RUMOR`: CLAIM 중심; 소문은 Canonical truth가 아니다.
- `ADD_NPC`: ENTITY 필수, 초기 STATE 선택.
- `UPDATE_NPC`: TARGET + STATE 필수, CAUSE/TIME 선택.
- `SET_NPC_STATUS`: TARGET + STATE 필수; identity/death 등 causal dependency의 핵심.
- `ADD_FACTION`: ENTITY 중심.
- `UPDATE_FACTION`: TARGET + STATE 필수.
- `ADD_NARRATIVE_SEED`: ENTITY 중심; STATE/TIME/CAUSE 선택.
- `RESOLVE_NARRATIVE_SEED`: TARGET + STATE(RESOLVED) 중심.
- `ADVANCE_CHAPTER`: STATE 중심, TIME 선택.
- `RECORD_OFFSCREEN_EVENT`: 중요한 causal evidence record; 현재 eventDescription free text 의존이 약점.
- `UPDATE_CHARACTER_STATS`: TARGET + STATE 중심; provenance와 결합 가능.
- `MODIFY_INVENTORY`: acquisition semantics의 핵심.
- `SET_CHARACTER_SECRET`: 현재 payload 기준 STATE 중심.
- `RECORD_PHYSICAL_DEFECT`: TARGET + STATE로 의미 명확화.
- `RECORD_DICE_RESULT`: CONSTRAINT + STATE 중심.
- `OVERWRITE_WORLD_INFO`: STATE 중심, 중앙 authority 유지.
- `OVERWRITE_CHARACTER`: STATE 중심, 중앙 authority 유지.

### MODIFY_INVENTORY의 핵심 signature

```text
DISCOVERY_PICKUP: SUBJECT + OBJECT + CAUSE; RECIPIENT 금지
GIFT_REWARD: SUBJECT + RECIPIENT + OBJECT + CAUSE
PURCHASE / RESOURCE_EXCHANGE: SUBJECT + COUNTERPARTY + OBJECT + VALUE/COST + CAUSE
LOOT: SUBJECT + SOURCE + OBJECT + CAUSE
```

획득 결과가 같아도 원인 구조가 같지 않다.

## 7. Causal Authority

```text
Historical Truth ≠ Current Causal Authority
```

과거 record의 존재만으로 현재 모든 mutation의 원인이 되지 않는다.

- 시간 경과/stateVersion 증가만으로 authority를 만료시키지 않는다.
- 실제 dependency 파괴 또는 명시적 invalidation/revocation에서 권한을 잃는다.
- NPC death, impostor/identity invalidation, explicit revocation, consumed event, resolved seed, target item invalidation 등을 검사한다.
- historical record는 삭제/변조하지 않는다.

Causal Witness는 엔진이 검증 후 발급하는 제한된 capability이며 특정 cause/effect 범위에 bound되고 임의 mutation으로 전용할 수 없다.

## 8. Jurisdiction

```text
Canon → Canon: Sovereign Engine → ALLOW / DENY
Novel → Canon: Novel은 cause candidate → Sovereign Engine → ALLOW / DENY
Novel → Novel: Recovery Gate → CONSISTENT / RECONCILIATION_REQUIRED
```

Novel을 무분별하게 Canon authority로 승격하지 않는다. Novel-Novel 불일치는 삭제/조용한 retcon이 아니라 reconciliation이다.

## 9. Anchor

```text
UNPROVEN
CONTRADICTED
DEPENDENCY
RECONCILIATION_REQUIRED
RESOLVED
```

Anchor는 강제 해결 목록이 아닌 안전 난간이다. Engine-side relevance filter가 현재 관련 anchor만 최소량 전달한다.

## 10. Natural Language → Causal Language

인간 언어를 keyword로 직접 분류하지 않는다.

### LLM
- 인간 언어 해석
- subject/object/recipient/source/counterparty/time/state/action/negation/condition/uncertainty 등 의미 슬롯 추출
- 모호함 보존
- authority 판결 금지

### Deterministic Compiler / Validator
- 추출 슬롯을 허용 구조로 정규화
- action-specific signature 검사
- 역할 중복/누락/금지 조합 검사
- causal relation 미증명 시 `UNPROVEN`
- GIFT/LOOT/DISCOVERY를 keyword 하나로 등치 금지

### Sovereign Engine
- Canon mutation 최종 판결

## 11. 인간 언어 표현 공격 기준

단순 문법이 아니라 **같은 사건을 인간이 얼마나 다양한 방식으로 표현하는가**를 공격한다.

공격군:

1. 직접: 발견/줍기/선물/구매/훔치기/보상.
2. 간접: 손에서 넘어감, 손에 들어옴, 챙김, 소유가 됨, 보관.
3. 생략/대명사/지시어: 그것/그에게/앞서 언급한 사람.
4. 부정: 주지 않음, 선물이 아님, 발견했지만 가져가지 않음.
5. 수동태/역행: 건네졌다, 발견되었다, 소유가 되었다.
6. 조건/가정/미래/가능성: 주기로 함, 줄 수도 있음, 줄 생각, 가능성이 있음.
7. 화행/의도와 실제 사건: 주려 함 ≠ 줌; 약속 ≠ 실행; 주장 ≠ 사실.
8. 복합 사건: 발견 후 전달, 구매 후 선물, 절도 후 판매, 보관 후 반환.
9. 정보 출처: 알고 있음, 들었다, 기록됨, 확인되지 않음.
10. 상태와 인과: 창고에 있음 ≠ 선물함; 소유 ≠ 선물; 만남 ≠ 전달; 발견 ≠ 전달.

## 12. 반드시 통과해야 할 의미 구분

```text
DISCOVER ≠ PICKUP ≠ POSSESS ≠ TRANSFER ≠ GIFT ≠ PURCHASE ≠ LOOT
INTEND_TO_GIVE ≠ PROMISE_TO_GIVE ≠ CLAIMED_TO_GIVE ≠ ACTUALLY_GAVE
MENTION ≠ OBSERVE ≠ KNOW ≠ PROVE
BEFORE ≠ CAUSES
EXISTS ≠ CURRENT_CAUSAL_AUTHORITY
```

실패 시 새 Atom을 즉시 추가하지 않고 기존 11 Atom의 구조 표현력과 signature가 충분한지 먼저 검증한다.

## 13. 공격 판정 기준

각 표현에서:
1. 의미 슬롯 정확 복원
2. participant role 구분
3. 부정/조건/가능성/의도/주장/관찰/실제 사건 구분
4. 시간과 인과 분리
5. 대명사/지시어/수동태/생략 entity 연결
6. 복합 사건 분리
7. 증거 부족 시 UNPROVEN/UNKNOWN
8. MeaningTree→Runtime Projection 의미 보존
9. Sovereign authority 보존
10. historical record 보존

## 14. 현재 공격 시작점

- ROLE vocabulary/cardinality가 Grammar에 고정되지 않음.
- Runtime Projection에서 ROLE 정보 손실 가능성.
- RECORD_OFFSCREEN_EVENT의 free-text 의존.
- broad keyword 기반 causal proof.
- 부정/화행/정보출처 표현의 미검증.
- point-like TIME의 한계.
- RELATION/ROLE/reference 방향성 검증 필요.

## 15. 절대 원칙

- Core Atom 추가는 첫 해결책이 아니다.
- 의미 중복 enum을 추가하지 않는다.
- LLM에게 authority를 위임하지 않는다.
- keyword matching을 최종 causal proof로 사용하지 않는다.
- historical record를 삭제/수정해 모순을 숨기지 않는다.
- 시간 경과만으로 causal authority를 만료시키지 않는다.
- Novel/Canon 관할을 섞지 않는다.
- `UNPROVEN`을 `DENY`로 오인하지 않는다.
- `DENY`와 narrative reconciliation을 같은 문제로 취급하지 않는다.

## 16. 개발 순서

```text
1. 설계 기준선 고정
2. 인간 언어 표현 공격
3. 실패 유형 분류
4. 기존 11 Atom으로 표현 가능한지 증명
5. ROLE/grammar/signature/projection 보강 여부 결정
6. 필요할 경우에만 표현 구조 확장
7. 구현
8. Sovereign Engine E2E red-team
9. 장기 시간/identity/invalidation 재공격
```

**현재 단계: 1 완료. 다음 단계: 인간 언어 표현의 한계까지 공격.**

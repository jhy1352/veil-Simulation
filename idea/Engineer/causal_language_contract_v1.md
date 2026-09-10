# VEIL Causal Language v1 — Semantic Contract

- Document ID: `IDEA-ENGINEER-CAUSAL-LANGUAGE-CONTRACT-V1`
- Status: `DESIGN CONTRACT — PRE IMPLEMENTATION`
- Date: `2026-09-08`
- Branch: `work/identity-continuity`
- Parent: `causal_language_development.md`

> 목적: 인간 언어 → Semantic IR → 결정적 Causal Language Compiler → MeaningTree → Runtime → Sovereign Engine 경계를 구현 가능한 계약으로 고정한다.
>
> 이 문서는 구현 완료 선언이 아니다. 아래 계약이 구현 및 테스트의 기준이다.

## 1. 불변 Core Ontology

Core Atom은 정확히 다음 11개로 고정한다.

```text
ENTITY ACTION STATE RELATION CLAIM TIME CAUSE ROLE INTENT VALUE CONSTRAINT
```

다음 개념을 Core Atom으로 승격하지 않는다.

```text
GIFT LOOT PURCHASE DISCOVERY RETURN PROMISE BELIEF KNOWLEDGE
LOCATION OWNERSHIP RIGHT LAW CONTRACT BEFORE AFTER OVERLAPS
CAUSES ENABLES INVALIDATES
```

이들은 Action subtype, Relation taxonomy, State, Constraint, Scope, Operator 또는 Authority rule로 표현한다.

## 2. Semantic Event 기본 단위

자연어 문장 자체가 분류기의 입력 단위가 아니다.

분류기의 최소 입력 단위는 `Semantic Event`다.

개념적 구조:

```text
SemanticEvent {
  eventId
  action
  roles[]
  states[]
  relations[]
  values[]
  times[]
  causes[]
  constraints[]
  intent?
  scope
  polarity
  epistemicStatus
  modality
  provenance
  references
  temporalPrecision
  literalness
}
```

위 필드들은 새 Core Atom이 아니다. 11 Atom의 의미를 손실 없이 운반하기 위한 IR/Operator metadata다.

## 3. Event Segmentation

한 자연어 문장에 여러 사건이 포함되면 하나의 Action으로 압축하지 않는다.

예:

```text
삼화상인이 은화를 발견한 뒤 플레이어에게 선물했다.
```

은 최소 두 사건이다.

```text
E1: DISCOVER(subject=삼화상인, object=은화)
E2: GIFT(subject=삼화상인, recipient=플레이어, object=은화)
```

`E1 → E2`의 시간/인과 관계는 별도로 표현한다.

표면적 접속어만으로 CAUSE를 자동 생성하지 않는다.

## 4. ROLE Vocabulary v1

Canonical role label은 다음 집합으로 제한한다.

```text
SUBJECT
TARGET
OBJECT
RECIPIENT
SOURCE
COUNTERPARTY
LOCATION
INSTRUMENT
BENEFICIARY
SPEAKER
OBSERVER
HOLDER
OWNER
```

원칙:

- ROLE은 기본적으로 대상 Entity reference를 가리킨다.
- Surface word order가 semantic role을 결정하지 않는다.
- 동일 Action에서 동일 role의 중복은 기본 금지한다.
- 복수 participant는 동일 role의 복수 occurrence가 아니라 명시적인 group Entity 또는 허용된 multiplicity contract로 표현한다.
- ROLE label 자체가 새로운 Atom이 아니다.

### 주의

`LOCATION`, `OWNER`, `HOLDER` 등은 의미상 필요하지만 Core Atom이 아니다. 장소/권리/계약/집단 등도 필요한 경우 ENTITY로 reify하고 Relation/Role로 연결한다.

## 5. Action Signature

결정적 Compiler는 Action별 required/allowed/forbidden role을 검사한다.

대표 계약:

```text
DISCOVER
  required: SUBJECT, OBJECT
  forbidden: RECIPIENT

PICKUP
  required: SUBJECT, OBJECT

GIFT
  required: SUBJECT, RECIPIENT, OBJECT

PURCHASE
  required: SUBJECT, COUNTERPARTY, OBJECT, VALUE

RESOURCE_EXCHANGE
  required: SUBJECT, COUNTERPARTY, OBJECT
  optional: VALUE

LOOT
  required: SUBJECT, SOURCE, OBJECT

RETURN
  required: SUBJECT, RECIPIENT, OBJECT

PROMISE
  required: SUBJECT, RECIPIENT, OBJECT
  semantic status: COMMITMENT/INTENT, never automatic execution

UPDATE_STATE
  required: TARGET
```

`GIFT`와 `DISCOVER`를 문자열 keyword 하나로 판별하지 않는다.

## 6. Acquisition Action Mapping

Runtime의 기존 `MODIFY_INVENTORY`가 최종 mutation surface다. Causal Language는 그 안의 acquisition semantics를 더 엄격하게 구조화한다.

```text
DISCOVERY_PICKUP
  SUBJECT + OBJECT + CAUSE
  RECIPIENT forbidden

GIFT_REWARD
  SUBJECT + RECIPIENT + OBJECT + CAUSE

PURCHASE / RESOURCE_EXCHANGE
  SUBJECT + COUNTERPARTY + OBJECT + VALUE/COST + CAUSE

LOOT
  SUBJECT + SOURCE + OBJECT + CAUSE
```

중요:

```text
DISCOVER != PICKUP != POSSESS != TRANSFER != GIFT != PURCHASE != LOOT
```

목표 Inventory 상태가 동일하더라도 causal provenance가 다르면 같은 사건으로 canonicalize하지 않는다.

## 7. Scope / Polarity / Epistemic / Modality

### Scope
기존 Scope 집합을 유지한다.

```text
CANONICAL CLAIM HYPOTHETICAL PROPOSAL OFFSCREEN INTENT HISTORICAL OBSERVATION UNVERIFIED
```

### Polarity
최소:

```text
ASSERTED
NEGATED
UNKNOWN
```

중첩 부정은 구조로 보존한다. 표면 문자열에서 부정어를 제거하지 않는다.

### Epistemic Status
최소:

```text
OBSERVED
ASSERTED
HEARSAY
INFERRED
UNVERIFIED
UNKNOWN
VERIFIED
```

### Modality
최소:

```text
NONE
POSSIBLE
NECESSARY
COUNTERFACTUAL
INTENTIONAL
COMMITMENT
```

이 값들은 사실/권위 자체가 아니다.

## 8. Reference Contract

대명사/지시어/생략 Entity는 결정적 Compiler가 임의 생성하지 않는다.

```text
RESOLVED(reference -> entityId)
UNRESOLVED(reference)
AMBIGUOUS(reference -> candidates[])
```

`UNRESOLVED` 또는 `AMBIGUOUS` 상태에서 필요한 participant를 임의 확정하여 Action Signature를 통과시키는 것은 금지한다.

예:

```text
그가 그것을 그녀에게 건넸다.
```

주체/객체/수령자가 문맥으로 확정되지 않으면 `UNKNOWN/RECONCILIATION_REQUIRED` 경로로 보낸다.

## 9. Provenance Contract

각 의미 사건은 가능하면 다음 provenance를 보존한다.

```text
sourceType
sourceId
originInputId
evidenceIds
parentEventIds
extractionStatus
```

LLM extraction 결과는 provenance를 가진 비권위 입력이다.

Causal Witness는 Sovereign Engine의 검증 이후에만 발급한다.

## 10. Causal Semantics

### CAUSE
`CAUSE`는 하나 이상의 사건/상태를 결과 사건과 연결할 수 있다.

복수 원인은 하나의 CAUSE container 내부에서 명시한다.

```text
CAUSE(UNORDERED)
  ├─ ACTION(C command)
  └─ ACTION(D cooperation)
```

필요한 결합 조건(ALL/ANY/NECESSARY 등)은 Operator/Relation taxonomy로 정의하며 Core Atom을 추가하지 않는다.

### Temporal order

```text
BEFORE / AFTER / SAME_TIME
```

은 TIME 비교에서 파생한다. 저장된 중복 enum을 기본 사용하지 않는다.

### Causality

```text
BEFORE != CAUSES
SAME_TIME != CAUSES
CORRELATED != CAUSES
```

시간 순서만으로 causal witness를 발급하지 않는다.

### INVALIDATION
`INVALIDATES`는 표현 가능한 Relation이지만 현재 권위 판단은 Sovereign Engine의 deterministic invalidation rules가 담당한다.

## 11. Observation / Claim / Reality Separation

다음은 서로 다른 의미다.

```text
OBSERVE(event)
CLAIM(event)
KNOW(event)
PROVE(event)
CANONICAL(event)
```

예:

```text
경비가 “삼화상인이 플레이어에게 은화를 줬다”고 말했다.
```

은:

```text
CLAIM
  SPEAKER = 경비
  CONTENT = GIFT(삼화상인 -> 플레이어, 은화)
  epistemicStatus = ASSERTED/HEARSAY
```

이며 자동으로 Canonical GIFT가 되지 않는다.

## 12. Unknown / Unproven Policy

기계가 의미를 모를 때 추측하지 않는다.

```text
UNKNOWN
UNPROVEN
CONTRADICTED
RECONCILIATION_REQUIRED
INVALID
```

을 구분한다.

특히:

```text
UNPROVEN != DENY
```

`UNPROVEN`은 현재 권위 있는 증거가 부족하다는 뜻이며 사건 자체가 거짓이라는 뜻이 아니다.

## 13. Semantic Classifier 출력

결정적 Classifier/Compiler의 출력은 다음 중 하나다.

```text
COMPILED
UNKNOWN
UNPROVEN
CONTRADICTED
RECONCILIATION_REQUIRED
INVALID
```

`COMPILED`는 문법적으로 표현 가능한 구조라는 뜻이지 Canonical truth라는 뜻이 아니다.

## 14. MeaningTree Projection Invariant

현재 Runtime Projection은 MeaningTree를 authoritative source로 사용하며 `Proposal.actions`와 deterministic projection의 불일치를 거부한다. 이 원칙을 유지한다.

추가 불변식:

```text
Semantic meaning that affects authority
MUST survive
Semantic IR → MeaningTree → Runtime Proposal
```

특히 ROLE, provenance, acquisition cause를 `fields.payload`에만 숨겨 MeaningTree 구조에서 사라지게 만드는 구현은 금지한다.

현재 adapter는 MODIFY_INVENTORY에서 item/CAUSE를 생성하지만 SUBJECT/RECIPIENT/COUNTERPARTY 등의 semantic role을 구조적으로 생성하지 않는다. 따라서 구현 시 이 의미 손실을 해결한 뒤에만 Action Signature enforcement를 활성화한다.

## 15. RECORD_OFFSCREEN_EVENT

현재 `eventDescription` free text에 causal meaning이 남는 것은 약점이다.

향후 causal evidence로 사용되는 offscreen event는 가능하면:

```text
eventDescription
+
structured MeaningTree / Semantic Event
+
participant roles
+
time
+
provenance
+
status
```

를 함께 보존한다.

Free text keyword hit만으로 causal authority를 발급하지 않는다.

## 16. Causal Authority Contract

권위 흐름:

```text
Historical Record
      ↓
Causal Candidate
      ↓
Authority Resolver
      ↓
ALLOW / DENY / UNPROVEN
      ↓
Engine-issued Witness
      ↓
Canonical Mutation Validation
```

Resolver는 최소한 다음을 검사한다.

- event provenance
- action signature
- participant identity continuity
- source/recipient relationship
- target item identity
- event consumption
- explicit revocation/invalidation
- resolved narrative seed
- canonical contradiction
- dependency invalidation

시간 경과/stateVersion 증가만으로 authority를 만료시키지 않는다.

## 17. Existing Keyword Proof의 지위

현재 broad keyword 기반 causal proof는 **legacy compatibility evidence**로 취급한다.

예:

```text
발견
받다
건네다
보상
조우
```

등의 단어가 있다는 사실만으로 GIFT/LOOT/DISCOVERY를 증명할 수 없다.

최종 authority path에서는 구조화된 Semantic Event와 provenance가 우선하며, keyword-only proof는 sufficient proof가 아니다.

## 18. Runtime Action Mapping 원칙

Causal Language의 고수준 Action subtype과 기존 19 Runtime ActionType은 1:1 동일 개념이 아니다.

예:

```text
GIFT
  ↓
MODIFY_INVENTORY(operation=ADD, acquisition.cause=GIFT_REWARD)
```

단, Runtime payload가 표현하지 못하는 participant semantics를 MeaningTree에 보존해야 한다.

따라서 다음 중 하나를 구현 전에 결정한다.

1. TransitionAction payload에 구조화된 provenance/participant metadata를 확장하거나,
2. MeaningTree를 authority-bearing immutable companion record로 보존하고 Runtime action과 강한 ID linkage를 둔다.

어느 방식이든 의미 손실이 없어야 한다.

## 19. Deterministic Compiler 원칙

Compiler는 다음을 할 수 있다.

- schema normalization
- role validation
- cardinality validation
- reference validation
- event segmentation validation
- polarity/modality propagation validation
- action signature matching
- canonical serialization
- ambiguity routing

Compiler는 다음을 할 수 없다.

- missing participant 추측
- recipient 발명
- cause 발명
- claim을 fact로 승격
- keyword만으로 causal authority 발급
- historical record 삭제/수정
- LLM이 만든 authority/witness 신뢰

## 20. Golden Examples

### A — Discovery
```text
삼화상인이 은화를 발견했다.
→ DISCOVER(SUBJECT=삼화상인, OBJECT=은화)
→ no RECIPIENT
```

### B — Gift
```text
삼화상인이 플레이어에게 은화를 선물했다.
→ GIFT(SUBJECT=삼화상인, RECIPIENT=플레이어, OBJECT=은화)
```

### C — Explicit negation
```text
삼화상인은 은화를 발견했지만 플레이어에게 주지는 않았다.
→ DISCOVER(...)
→ GIFT(..., polarity=NEGATED)
```

### D — Intent only
```text
삼화상인은 플레이어에게 은화를 주려고 했다.
→ INTENT → GIFT
→ actual GIFT not established
```

### E — Hearsay
```text
경비가 삼화상인이 은화를 줬다고 말했다.
→ CLAIM(source=경비, content=GIFT(...))
→ no automatic Canonical GIFT
```

### F — Unknown cause
```text
은화가 결국 플레이어의 손에 들어왔다.
→ TRANSFER/STATE result may be represented
→ CAUSE=UNKNOWN
→ no automatic GIFT/PURCHASE/LOOT
```

### G — Multiple events
```text
삼화상인이 은화를 발견한 뒤 플레이어에게 선물했다.
→ E1 DISCOVER
→ E2 GIFT
→ temporal/causal relation separately represented
```

## 21. Red-Team Acceptance Tests

구현 후 최소 다음을 통과해야 한다.

1. 능동/수동태가 동일 semantic roles로 정규화된다.
2. 대명사 미해결을 추측하지 않는다.
3. 이중부정을 보존한다.
4. INTENT/PROMISE/CLAIM/OBSERVATION을 actual event와 분리한다.
5. Discovery keyword만으로 Gift authority가 생성되지 않는다.
6. 소유/보유/위치를 증여로 오인하지 않는다.
7. 동일 Item의 이동만으로 acquisition cause를 발명하지 않는다.
8. 복수 원인을 하나의 원인으로 손실시키지 않는다.
9. 시간 선후만으로 CAUSE를 만들지 않는다.
10. Historical record와 current causal authority를 분리한다.
11. 죽음/impostor/identity break 등 dependency invalidation을 재검증한다.
12. MeaningTree의 ROLE 정보가 Runtime proposal에서 손실되지 않는다.
13. `Proposal.actions`를 조작해 MeaningTree authority를 우회할 수 없다.
14. Novel→Novel 충돌은 reconciliation으로 남는다.
15. Canon→Canon / Novel→Canon mutation은 Sovereign Engine만 최종 판결한다.
16. 다국어 입력에서 언어별 surface form이 동일한 Semantic IR을 생성할 수 있는 구조를 유지한다.
17. 의미가 불충분한 입력은 UNKNOWN/UNPROVEN으로 안전하게 빠진다.
18. Keyword-only causal evidence가 sufficient proof가 아니다.

## 22. Implementation Order

```text
1. ROLE vocabulary + cardinality contract
2. Action signature registry
3. Semantic Operator / metadata contract
4. Semantic Event IR
5. Deterministic classifier/compiler
6. MeaningTree emission
7. MeaningTree ↔ Runtime projection preservation
8. Structured offscreen causal evidence
9. Causal Authority migration away from keyword-only proof
10. Golden + multilingual + R1-U red-team
```

## 23. Current Verdict

```text
11 Core Atoms: FROZEN
Semantic model: SUFFICIENT BY CURRENT RED-TEAM
ROLE: IMPLEMENTATION BLOCKER
Semantic Operators: IMPLEMENTATION BLOCKER
MeaningTree projection preservation: IMPLEMENTATION BLOCKER
Causal keyword proof: NOT ACCEPTABLE AS FINAL AUTHORITY
```

새 Core Atom은 위 계약을 구현하고 red-team에서 실제 표현 불능이 증명될 때만 재검토한다.

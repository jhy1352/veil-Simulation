# QWEN-HL-E01 — 《홍루몽(紅樓夢)》 서사 엔진 및 텍스트 포렌식 로드맵

## RECORD STATUS

- ANALYZER: Qwen
- WORK_ID: HL-E01
- TITLE: 《홍루몽(紅樓夢)》
- AUTHOR: 조설근 (曹雪芹)
- RECORD_TYPE: RESEARCH_ROADMAP
- SOURCE_STATUS: UNKNOWN / supplied roadmap
- DIFFERENTIAL_DATA_STATUS: NOT_YET_COMPLETE
- GENERALIZATION_STATUS: NOT_APPLICABLE

> 이 파일은 현재 전달된 Qwen 결과가 '서사 엔진 및 텍스트 포렌식 최종 로드맵'이므로, 이를 작품별 Differential Record로 가장하지 않고 연구 계획/검증 대상 목록으로 보존한다. 실제 PRE→EVENT→POST 데이터가 제공되면 별도 정규화 레코드로 추가한다.

## ROADMAP

### STEP 0 — 현재 판본 Migration 최종 포렌식

현재 80회 원고(조설근)와 40회 속서(고악)의 Migration을 원본 필사본 및 raw evidence와 대조한다.

검증 경로:
`필사본 경로 → 정본화 → 단일 서사 투영(120회 정을본 또는 80회 지연재본) → 인물 서사 → 비평 검증 → 최종 텍스트(Commit)`

핵심 조건:
- 원본 의미 훼손 없음
- 위작/의미 변형 판정 시 DENY
- ZERO MUTATION으로 원본 보존
- Production 경로에 의미 변형된 속서와 원본 의미가 혼재하지 않음

### STEP 1 — 서사 엔진 전체 요소 전수 목록화

대관원에 한정하지 않고 전체 semantic element를 추적한다.

후보 요소:
`인물(Node), 사건(Atom), 가문(Scope), 시가(Value), 관계(Fields), 상징(References), 호칭(Tags), 예언(Claims), 행동(Actions), 동기(Intent), 인과(Cause), 시간(Time), Entity, State, 복선(Composition)`

추적 경로:
`원전 표현 → 현대어 Canonical Representation → 번역/역본 Serialization → 의미 복원/Recovery → MeaningTree → Runtime Projection → Proposal → Validator → Mutation → Commit`

목표:
텍스트에 존재하는 의미가 서사 처리 과정에서 소실되는 경로를 식별한다.

### STEP 2 — 인과율 / 복선 Operator 전수검증

각 복선에 대해:
`입력 의미 → 복선 Operator → 출력 의미 → Canonicalization → Runtime Effect`

검증 후보:
- 동일성
- 상징
- 별명/호칭 변화
- 가문 관계
- 가문 몰락
- 봉건적 제약
- 전세의 인연
- 계절/시간
- 대관원 구성
- 영욕 상태 변화

판정 대상은 문법적 장식인지 실제 서사적 의미를 갖는지 여부다.

### STEP 3 — 번역 / 결실 회복(Recovery) Gate

경로:
`원전 텍스트 → 번역/결실 회복 → 현대적 서사 이해(MeaningTree)`

검증:
- valid semantic input → valid MeaningTree
- 불완전/결실 데이터 → deterministic recovery
- 지연재 비평의 모호함 → 임의 의미 생성 금지
- 회복 불가능한 원고 → DENY 및 결실 기록

핵심 불변식:
Recovery가 조설근의 원래 세계 의미를 임의 창조하지 않는다.

### STEP 4 — 판본 평등 / 정전화 전수검증

비교 후보:
- 지연재본 == 정을본의 핵심 서사 여부
- 지연재본 == canonical 여부
- 갑술본 != 정을본의 세부 이본 차이

적대적 검사 대상:
`이본, 별명, 회차 순서, 중첩, 생략, 빈 구조, 중복`

목표:
필사 → 간행 → 정전화 과정에서 의미 보존 여부를 확인한다.

### STEP 5 — 신화 → 현실 서사 Projection

후보 불변식:
`현실 서사 === projectMythology(신화적 프레임)`

예:
`신화적 구성(신영석기/강주선초) → 현실 투영(보옥/대옥)`

투영이 신화적 의미를 임의 추가/삭제하지 않는지 검증한다.

### STEP 6 — 비평 권위 Firewall

후보 경계:
`조설근 원고 → deterministic projection → 지연재 비평`

검증 대상:
`비평 + extra 해석, 비평 - 원문, 재배열, 대체, 생략`

원고의 권위를 비평이 변형하지 않도록 DENY + ZERO MUTATION을 적용한다.

### STEP 7 — 예언(Claim) Lifecycle

추적 경로:
`예언 생성 → 독자 해석 → Commit → 후속 사건 → 예언 영향/복선 회수 → Invalidation`

후보 인과 사슬:
- A. 예언 → 파생 사건
- B. 별명 → 호칭 변경 → 기존 예언
- C. 회차 내 복선 구성 → 시사의 암시
- D. 사후 실제 사건 → 예언 재현
- E. 가문 간 서사 영향

실제 텍스트 경로에서 증명해야 하며, 현재는 후보 목록으로만 저장한다.

### STEP 8 — 가문 간 / 인과율 전수검증

가문 간 상태와 영향 전이를 검증한다.

예시 공격 후보:
`stale claim, hidden mutation, cross-authority mutation, alias mutation, derived mutation`

기존 가문 검증을 우회하는지 확인한다.

### STEP 9 — 시가 ↔ 서사 Round-Trip

후보 경로:
`서사 상황 → 시가 창작 → 텍스트 기록 → 정전화 → 미래 암시`

가능한 경우:
`독자 해석 → 번역 → MeaningTree → 인물 투영 → 행동 → 실행 → 결말`

목표:
의미 손실 경로를 식별하고 round-trip 완전성을 검증한다.

### STEP 10 — 홍학 적대적 Red Team

복합 공격 예:
`속서 bypass + 태허환경 생략 + 인물 주입 + 별명 대체 + 예언 재현 + 인과율 조작`

개별 해석론을 조합했을 때 원전 의미/비극 보존이 깨지는지 검사한다.

### STEP 11 — 비극 불변성 / ZERO MUTATION

DENY 공격에 대해 `success === false`만 확인하지 않는다.

before/after 비교 대상:
`가문 상태, 서사 버전, 회차, 역사, 예언, 인물, 자원(대관원), 파생 상태`

공격 실패 후 원본 비극 상태의 변화 여부를 검증한다.

### STEP 12 — 홍학 파동 / 텍스트 회귀

통합 suite 후보:
`텍스트, 서사, 대관원 투영, 예언, 인과율, Red Team, 판본, 고증`

핵심 판정:
연구/분석 결과의 양이 아니라 원전 의미 보존 여부.

### STEP 13 — 독자 경계 Production Boundary Audit

독자 경로 후보:
`독자 → 번역본 → 해설 → Recovery → 서사 트리 → 투영 → 이해 → 권위 → 실행(독서) → 이해(Commit)`

검증:
- 독자가 잘못된 속서/해석으로 canonical 경계를 임의 변경할 수 있는지
- 연구 전용 정보가 독자 경험을 불필요하게 훼손하는지

### STEP 14 — 최종 판본 Forensic Freeze

고정 후보:
`최종 HEAD(정을본 또는 지연재본), 판본 SHA, 텍스트 트리, 고증 결과, Red Team 결과, 서사 구조`

최종 대조:
`텍스트 ↔ 홍학 보고서/연구 결과`

### STEP 15 — 서사 엔진 Final Sign-off

최종 승인은 개별 해석 통과가 아니라 전체 실패 경로의 폐쇄를 요구한다.

후보 실패 경로:
`속서, 해피엔딩 변형, 모호함, 결실, 불일치, 주입, 재현, 오해, 권한 없음, 인과 무효`

요구 결과:
`DENY + ZERO MUTATION`

## NORMALIZATION STATUS

이 로드맵에서 직접 추출 가능한 것은 '검증 대상/연산/불변식/실패 경로'이며, 실제 작품 관찰의 PRE/EVENT/POST/Δ 데이터는 아니다.

따라서 다음 필드는 의도적으로 생성하지 않았다:
- SCENE_RECORDS
- CANONICAL_VARIABLE_OBSERVATIONS
- CHANGE_VECTORS
- TRAJECTORY_RECORDS
- CROSS_WORK_GENERALIZATION

이는 데이터 누락이 아니라 **증거 경계 보존**이다.

## NEXT DATA REQUIRED

Qwen의 다음 조사 결과에서 실제 작품 텍스트를 처음부터 끝까지 관찰한 결과가 들어오면 다음 단위로 별도 저장한다:
`WORK → SCENE → PRE_STATE → EVENT → POST_STATE → ΔSTATE → Δ²STATE → ACCUMULATION → TRAJECTORY → STRUCTURE → MECHANISM → VARIATION → LOSS_RISK → CONFIDENCE → PROVENANCE`

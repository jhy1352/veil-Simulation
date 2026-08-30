# TRPG 3.1 — 주요 설계 결정 기록 (Design Decisions)

본 문서는 TRPG 3.1 Sovereign Engine의 핵심 아키텍처 및 시스템 설계 결정 사항(Architecture Decision Records, ADR)을 정리한 공식 문서이다. 각 항목은 코드베이스, 헌법, 프로토콜 및 Git 기록에서 실제 확인된 팩트만을 기술한다.

---

## 1. Engine Sovereignty (세계 주권 및 진실성 권위)

- **결정 사항**: LLM과 플레이어의 선언은 단순 제안(Proposal/Claim)으로만 취급하며, Canonical State의 최종 변경 권위는 엔진(Commit Gate)에만 귀속한다.
- **결정 배경**:
  - LLM이 직접 세계 상태를 변경하거나 사실을 확정할 경우 환각(Hallucination), 인과 왜곡, 상태 불일치 및 자가 승인 루프가 발생함.
  - 플레이어의 자연어 프롬프트가 검증 없이 현실로 확정되면 세계 법칙 파괴(무단 아이템 생성, 전지적 능력 주장 등)가 발생함.
- **선택한 방향**:
  - 단방향 진실 흐름: `World Truth → Engine Boundary → LLM Narrative Interpretation → Engine State-Change Validation → Commit`.
  - 상태 전이 제안은 `SOURCE_ACTION_ACL`과 `Causality Gate`를 통과해야만 불변의 `HistoricalRecord`로 커밋됨.
- **유지해야 하는 불변 원칙**:
  - 헌법 제1조(세계 주권의 원칙) 및 제6조(LLM은 세계의 판정자가 아니다).
  - "엔진이 허용하지 않은 것은 세계에서 발생하지 않는다."
- **관련 문서**:
  - `idea/Engineer/sovereign_engine_constitution.md` (제1조~제11조)
  - `idea/advisor_handoff.md` (섹션 0.2 Sovereign Authority)
- **관련 Commit**: `56f4a0d`, `d8ef01c`
- **현재 상태**: **COMMITTED & ENFORCED** (`src/engine/validator.ts`, `src/utils/engineValidator.ts`).

---

## 2. Narrative Freedom & Narrative–Runtime Balance (서사 보존과 엔진 주권의 공존)

- **결정 사항**: 엔진의 무결성 검증을 이유로 LLM의 문학적 표현, 감정 묘사, 대화 뉘앙스, 개연성 추론을 기계적으로 억압하거나 축소하지 않는다.
- **결정 배경**:
  - 지나치게 엄격한 0/1 이진 판정이 서사의 아날로그적 뉘앙스와 인간적인 대화 깊이를 저해하여 텍스트 게임의 재미를 훼손하는 부작용 방지.
- **선택한 방향**:
  - 은닉 사실(이미 존재하지만 숨겨진 것)과 미창작 사실(아직 창작되지 않은 서사 요소)을 분리.
  - 미창작 사실은 기존 법칙과 충돌하지 않는 범위에서 LLM의 창작 제안을 허용하되, 최종 세계 상태 승격 시점에만 엔진이 개입.
- **유지해야 하는 불변 원칙**:
  - 서사 보존 원칙: "엔진은 이야기의 진실을 보호해야 하며, 이야기를 기계적으로 작성해서는 안 된다."
- **관련 문서**:
  - `idea/Engineer/sovereign_engine_constitution.md` (`[ENGINE SOVEREIGNTY & NARRATIVE FREEDOM]`)
  - `idea/Engineer/llm_engine_interaction_protocol.md` (`[LLM / ENGINE RESPONSIBILITY BOUNDARY]`)
  - `idea/advisor_handoff.md` (섹션 0.3 Narrative–Runtime Balance)
- **관련 Commit**: `d8ef01c`
- **현재 상태**: **COMMITTED & FORMALIZED**.

---

## 3. Strict Information Asymmetry & Knowledge Graph (엄격한 정보 비대칭)

- **결정 사항**: 세계의 객관적 진실(World Truth)과 특정 캐릭터의 인지 상태(Character Knowledge)를 엄격히 분리 관리한다.
- **결정 배경**:
  - LLM 컨텍스트에 모든 세계 정보를 주입할 경우 NPC가 전지적 시점(Omniscience)으로 주인공의 비밀이나 숨겨진 사건을 알아맞히는 서사 붕괴 발생.
- **선택한 방향**:
  - 인물별 인지 상태를 `[미인지 상태]`, `소문(RUMOR)`, `직접 목격(OBSERVED)`, `경험(EXPERIENCED)` 등 구체적인 인과적 획득 경로로 관리.
  - LLM 프롬프트 주입 시 주인공 및 등장인물의 시야에 허용된 정보만 슬라이스하여 주입.
- **유지해야 하는 불변 원칙**:
  - 헌법 제13조(정보 경계의 세계법칙화), 제23조(정보 비대칭 원칙), 제42조(Information Asymmetry & NPC Knowledge).
- **관련 문서**:
  - `idea/Engineer/sovereign_engine_constitution.md`
  - `idea/Engineer/llm_engine_interaction_protocol.md`
- **관련 Commit**: `56f4a0d`, `ee30da8` (`INFO-B` 취약점 식별 후 후속 개선 과제 도출)
- **현재 상태**: **ACTIVE AUDITING & BOUNDARY ENFORCEMENT** (`src/engine/index/knowledgeGraph.ts`, `retriever.ts`).

---

## 4. Genre-Agnostic Narrative Play Runtime (범용 서사 플레이 런타임)

- **결정 사항**: 런타임 코어에 HP, EXP, 특정 무협/판타지 스탯 등의 특정 장르 전용 의미론을 하드코딩하지 않고, 일반화된 상태 전이 권위 구조로 구현한다.
- **결정 배경**:
  - 특정 TRPG 룰에 고정될 경우 추리극, SF, 정치극, 일상물 등 다양한 장르의 세계관으로 확장하기 어려움.
- **선택한 방향**:
  - 권위 구조의 일반화: `Player Input → Proposal → Validation → Draft → Commit Gate → Canonical State → History/Provenance → Narrative Projection`.
  - 장르별 스탯 및 규칙은 `WorldPack / Ruleset / Game Design Layer`를 통해 주입.
- **유지해야 하는 불변 원칙**:
  - `idea/advisor_handoff.md` (섹션 0.0 Project Identity & 0.1 Generality).
- **관련 문서**:
  - `idea/advisor_handoff.md`
  - `idea/Engineer/current_scope_and_dream_goals.md`
- **관련 Commit**: `56f4a0d`
- **현재 상태**: **CORE ARCHITECTURAL PRINCIPLE**.

---

## 5. Deterministic State Transitions & CSPRNG (결정론적 상태 전이 및 암호학적 난수)

- **결정 사항**: 모든 게임플레이 핵심 난수(주사위, 식별자 생성 등)에 `Math.random()` 사용을 금지하고 `window.crypto.getRandomValues()` (CSPRNG)를 강제한다.
- **결정 배경**:
  - 브라우저 기본 난수의 편향성 방지 및 난수 결과의 역사적 불변 기록 보존.
- **선택한 방향**:
  - `src/utils/dice.ts`에 CSPRNG 적용.
  - 주사위 롤 결과는 단순 서술 텍스트가 아닌 `RECORD_DICE_RESULT` 액션을 통해 검증 후 히스토리에 기록.
- **유지해야 하는 불변 원칙**:
  - 헌법 제8조(주사위는 엔진의 판정이며 서술의 참고자료가 아니다) 및 제36조(CSPRNG).
- **관련 문서**:
  - `idea/Engineer/sovereign_engine_constitution.md`
- **관련 Commit**: `56f4a0d`
- **현재 상태**: **COMMITTED & ENFORCED** (`src/utils/dice.ts`).

---

## 6. Single Commit Gate & Atomic Transactions (단일 커밋 관문 및 원자적 트랜잭션)

- **결정 사항**: 모든 상태 변경(플레이어 행동, LLM 제안, 세션 복원, 프리셋 로드 등)은 반드시 단일 `Commit Gate`를 통과하며, 다중 액션 중 1개라도 실패 시 전체를 롤백한다.
- **결정 배경**:
  - 상태 변경 경로가 다원화될 경우 검증 누락 및 중간 상태(Partial State) 오염 발생.
- **선택한 방향**:
  - Draft State에 순차 적용 후 전체 유효성 통과 시에만 단일 트랜잭션으로 Canonical State에 반영.
  - Proposal Replay 방어(동일 requestId/eventId 재제출 차단)와 Multi-Action Provenance(동일 eventId 하위 다중 액션 기록) 분리 처리.
- **유지해야 하는 불변 원칙**:
  - 헌법 제10조(Canonical Commit Gate), 제18조(State Transition의 원자성), 제19조(State Version 및 Stale State 방지).
- **관련 문서**:
  - `idea/advisor_handoff.md` (제4원칙 & 0.4 History Semantics)
  - `idea/Engineer/sovereign_engine_constitution.md`
- **관련 Commit**: `56f4a0d`, `56c86a9`, `ee30da8`
- **현재 상태**: **COMMITTED & ENFORCED** (`src/engine/validator.ts`, `src/engine/actionApplier.ts`).

---

## 7. Development Error Transparency vs Production User Display (오류 투명성과 사용자 경험 분리)

- **결정 사항**: 개발/감사 환경에서는 API 에러 코드, 스택, 검증 거부 사유 등을 가공 없이 완전 투명하게 보존하고, 사용자 배포 환경에서는 내부 기술 메타데이터를 서사에 노출하지 않는다.
- **결정 배경**:
  - "기운이 요동치며..." 등 가상의 서사로 API 429/503 에러나 검증 실패를 은폐하는 행위 방지.
- **선택한 방향**:
  - `DEVELOPMENT ERROR TRANSPARENCY`를 통해 원시 에러 로깅.
  - 사용자 화면에서는 우아한 서사 뷰를 유지하되 내부 디버깅 모달(`EngineDiagnosticsModal.tsx`)로 진단 정보 분리.
- **유지해야 하는 불변 원칙**:
  - 헌법 제31조(Development Error Transparency), 제37조(Narrative Isolation), Truthfulness Directive.
- **관련 문서**:
  - `idea/advisor_handoff.md` (제5원칙)
  - `idea/Engineer/sovereign_engine_constitution.md`
- **관련 Commit**: `56f4a0d`
- **현재 상태**: **COMMITTED & ENFORCED**.

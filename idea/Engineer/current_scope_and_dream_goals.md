# TRPG 3.1 — Current Scope & Dream Goals Architecture

## 1. 현재 구현 범위 및 핵심 목표 (Current Scope)

현재 TRPG 3.1의 최우선 목표는 새로운 기능을 계속 추가하는 것이 아니라, 이미 존재하는 엔진 구성요소를 **하나의 검증 가능한 실제 Runtime 경로로 수렴시키고 핵심 엔진을 완성하는 것**이다.

### 1.1 핵심 목표

1. **장르 독립적 서사 엔진 (Genre-Agnostic Narrative Engine)**
   - 특정 세계관이나 장르 관습에 종속되지 않는 범용 서사 시뮬레이션을 지향한다.
   - LLM은 개방적인 의미 해석·추론·서사 표현을 담당하고, Canonical State의 권위자가 아니다.

2. **Canonical State의 단일 권위**
   - Canonical State와 Immutable History를 하나의 Sovereign Engine이 소유한다.
   - Narrative Output, LLM Candidate, Player Claim은 그 자체로 Canonical Truth가 아니다.

3. **단일 Semantic → Commit Runtime 수렴**
   - 현재 존재하는 Candidate / Recovery / Adapter / Causal Compiler / MeaningTree / Runtime Projection 등의 중복 경로를 조사하고 최종 권위 경로를 하나로 수렴한다.
   - 목표 Runtime 개념 경로:
     `Player Intent / LLM → Candidate → Recovery → Semantic / Causal Representation → MeaningTree → Runtime Projection → Proposal → PreAuth → Sovereign Commit → Canonical State / Immutable History`
   - 각 단계가 실제 호출되는지 정적 코드 존재가 아니라 Runtime Trace로 입증한다.
   - 중복 파이프라인은 통합하거나 명확한 compatibility boundary 밖으로 격리한다.

4. **견고한 Canonical Commit Gate**
   - 인과성, 권한(ACL), 불변식, provenance 및 stale/duplicate 조건을 엄격하게 검증한다.
   - Commit 성공만이 Canonical State 변경의 권위가 된다.

5. **MeaningTree / Causal Language의 역할 명확화**
   - Causal Language는 별도의 세계 판결자가 아니라 LLM이 해석한 의미·상태·관계·인과 후보를 엔진이 검증 가능한 형태로 전달하는 semantic representation 계층을 목표로 한다.
   - MeaningTree가 canonical semantic representation으로 채택될 경우, Runtime Projection은 이를 유일한 action source로 사용한다.
   - Causal Compiler의 실제 Runtime 연결이 확인되기 전까지 이를 "완성된 Runtime"으로 간주하지 않는다.

6. **WorldPack / CanonPack 구조**
   - 세계 설정과 규칙의 모듈화 및 이식성을 확보한다.
   - Domain / WorldPack / Ruleset은 Core의 범용 권위를 우회하지 않는다.

7. **지속적인 정체성 및 세계 지속성**
   - 세션 전반에 걸쳐 인물 정체성, 관계, 상태, 영구적 결과, 역사적 provenance를 보존한다.
   - Identity Continuity의 강한 subsystem 검증 결과를 전체 Runtime 완성의 증거로 과대해석하지 않는다.

8. **장르 오염 및 편의주의 방지**
   - LLM의 임의적인 클리셰, 편의주의적 인과, 정보 비대칭 위반 등을 억제한다.
   - "Canonical Commit이 성공했다"와 "최종 narrative prose가 canonical facts를 정확히 표현한다"를 별개의 검증 문제로 취급한다.

9. **세션 저장 및 복원 무결성**
   - 스키마 버전, provenance, history monotonicity, hash/replay 검증을 유지한다.
   - 특히 장기 플레이에서 localStorage SessionPayload 확장과 저장 실패에 따른 in-memory / persisted-state divergence를 해결한다.
   - 저장 실패를 단순 경고로 끝내지 않고, 사용자에게 명확한 실패 상태를 전달하거나 저장 성공을 보장하는 구조를 확립한다.

### 1.2 현재 완료 판정에 필요한 핵심 검증

다음 항목은 "코드가 존재한다"만으로 PASS하지 않는다. 실제 Runtime 또는 재현 가능한 실행 증거가 필요하다.

- Causal Language → MeaningTree → Proposal → PreAuth → Sovereign Commit 실제 관통 경로
- Triage의 실제 Runtime 호출 및 PreAuth 이전 반영 여부
- 20+ turn 장기 context에서 Canonical State / World Rules가 narrative message window보다 항상 우선되는지
- Commit 이후 narrative prose가 canonical facts와 충돌하지 않는지
- 장기 SessionPayload 저장/복원 및 저장 실패 시 divergence 방지
- 장기 history에서 Passport / Identity / Inventory / Validator scan 비용의 실용적 한계

---

## 2. 현재 엔진 완성 작업 우선순위

### P0 — Runtime Pipeline Convergence

- 중복된 semantic / proposal / parsing 경로를 전수 조사한다.
- 최종 canonical semantic representation과 단일 Runtime 경로를 확정한다.
- 실제 한 턴을 기준으로 `LLM → Candidate → Semantic Representation → MeaningTree → Projection → Proposal → PreAuth → Commit`을 trace한다.
- 런타임에 연결되지 않은 구현은 "구현됨"과 "Runtime 사용됨"을 구분하여 기록한다.

### P0 — Persistence / State Durability

- 전체 SessionPayload의 장기 성장 문제를 해결한다.
- localStorage 저장 실패가 발생했을 때 in-memory Canonical State와 persisted state가 조용히 갈라지지 않도록 한다.
- 저장 성공 여부를 검증하고 복원 시 canonical provenance를 유지한다.

### P1 — Recovery Integrity

- EOF unterminated string 자동 종료를 제거한다.
- 의미를 추측하지 않고 구조적으로 유일하게 결정 가능한 복구만 허용한다.
- 수정 후 dedicated regression test와 실제 read-back 검증을 수행한다.

### P1 — Candidate Contract Integrity

- Candidate 5개 제한 전에 원본 cardinality를 검사하여 overflow를 조용히 잘라내지 않는다.
- `originInputId`와 `candidateId`를 서로 다른 provenance namespace로 유지한다.
- `originInputId` 누락 시 candidateId를 fallback으로 사용하지 않는다. 필수화하거나 명시적 UNKNOWN/REJECT로 처리한다.

### P1 — Causal Compiler Determinism

- deterministic compiler 내부의 event identity가 `Date.now()` 등에 의존하지 않도록 한다.
- 동일한 semantic input과 동일한 context에서 재현 가능한 결과를 보장한다.

### P1/P2 — Historical Scaling

- Passport, Identity, Inventory 및 validator의 반복적인 전체 history scan/sort를 조사한다.
- correctness와 performance를 별도 판정한다.
- 장기 history에 필요한 index / projection / incremental state 구조를 검토한다.

### P1/P2 — Narrative Authority

- Canonical Commit 이후 생성되는 prose가 Canonical State와 모순되지 않는지 별도의 Narrative Truth 검증 계층으로 다룬다.
- Commit Gate와 Narrative Truth Gate를 하나의 검증으로 취급하지 않는다.

---

## 3. 개발 단계에서 당장 하지 않을 것

- 핵심 Runtime 수렴 이전의 대규모 narrative feature 확장
- 검증되지 않은 Causal Language 기능의 추가 확장
- Human Narrative Prior DB를 Core Engine에 조기 결합
- Multiverse / cross-session persistence의 본격 구현
- 100k+ turn 안정성을 근거 없이 보장한다고 주장하는 것

Human Narrative Prior 연구는 향후 narrative quality 및 variation 문제를 다루는 별도 연구축으로 유지한다. Core Engine의 canonical authority가 먼저 안정되어야 한다.

---

## 4. 장기 비전: 멀티유니버스 및 세션 간 연결 (Multiverse & Long-Term Goals)

### 4.1 세션의 독립적 세계관 (Session as a Sovereign World)
- 각 세션은 독립적인 세계관과 고유한 Canonical State를 가진 하나의 완결된 서사 공간으로 작동한다.
- 플레이어의 행동과 선택은 해당 세계의 정사와 인물 상태에 축적된다.

### 4.2 경험의 영속성 (Experience Permanence)
멀티유니버스 확장의 핵심은 단순한 공간 이동이 아닌 **경험의 인과적 영속성**이다:
- 주인공이 다른 세계/세션을 방문하여 획득한 경험, 관계, 적대, 지식, 아이템, 기억, 영구적 부상이 원래 세계로 복귀했을 때도 지속적으로 유지되어 이후 서사에 반영된다.

### 4.3 타 플레이어 세션 연결 및 파티 플레이 (Co-Op Party & Shared Narratives)
- 조건 충족 시 타 플레이어의 세계에 방문자로 참여하여 공동 사건을 해결하는 파티형 서사 통합.
- 엔진은 다중 플레이어의 행동을 단일 세계 상태와 인과적 서사 흐름으로 통합 조율한다.

### 4.4 세계 독립성과 Canon 격리 (Canon Isolation)
- 각 세계는 고유한 역사적 정합성을 유지하며, 세션 간 상호작용이 발생하더라도 한 세계의 사건이 다른 세계의 고유 Canon을 임의로 훼손하거나 덮어쓸 수 없다.

---

## 5. 단계별 개발 원칙 (Staged Development Principle)

1. **기반 우선 원칙**: 멀티유니버스 및 다중 세션 연동은 현재 즉시 구현 대상이 아니다. 핵심 Runtime의 주권, semantic pipeline convergence, 상태 무결성, 인과성 검증, Commit Gate, persistence 안정화가 검증된 이후 착수한다.
2. **증거 우선 원칙**: 과거 보고서나 설계 문서의 PASS 표기는 현재 PASS의 자동 증거가 아니다. 현재 코드와 재현 가능한 실행 증거를 우선한다.
3. **구현과 연결의 분리**: 파일/함수의 존재는 Runtime 연결을 의미하지 않는다. `IMPLEMENTED`, `RUNTIME_CONNECTED`, `RUNTIME_VERIFIED`를 별도로 기록한다.
4. **최종 비전**: TRPG 3.1은 단순한 챗봇 서비스가 아니라, **AI가 구축한 지속적인 서사 세계 속에서 플레이어가 자신의 삶과 역사를 영속적으로 살아가는 Sovereign Narrative Engine**을 지향한다.
5. Core는 Domain/Game Design을 판단하지 않으며, 장르별 정책은 상위 계층에서 제공한다.

---

## 6. 현재 완료 기준 (Definition of Engine Completion)

엔진 완성은 "기능 파일이 모두 존재한다"가 아니라 다음을 만족하는 상태로 정의한다.

1. 하나의 실제 Runtime 경로가 LLM/Player intent에서 Sovereign Commit까지 관통한다.
2. Semantic representation과 Canonical State 사이에 권위 우회 경로가 없다.
3. Recovery / Candidate / Causal / Triage 계층이 서로 중복되거나 모순된 판결을 하지 않는다.
4. Canonical State와 Immutable History가 단일 write authority를 유지한다.
5. Persistence failure가 조용한 state divergence를 만들지 않는다.
6. provenance, identity continuity, replay 및 hydration 검증이 실제 저장/복원 경로에서 재현된다.
7. 장기 context에서 narrative memory와 canonical authority가 혼동되지 않는다.
8. Commit된 Canonical State와 사용자에게 표시되는 narrative 사이의 명백한 사실 충돌이 별도 검증된다.
9. 핵심 invariants가 정적 코드뿐 아니라 실제 Runtime trace / regression evidence로 입증된다.
10. 위 항목에서 아직 미검증인 것은 PASS로 승격하지 않고 OPEN 또는 UNKNOWN으로 유지한다.

---

## 7. Status Vocabulary

- **PASS** — 현재 코드와 실행 증거가 불변조건을 지지하며 확인 범위 내 반례가 없음.
- **OPEN** — 결함 또는 미연결/미완료 검증이 확인됨.
- **UNKNOWN** — 현재 확보된 증거만으로 결론을 낼 수 없음.
- **HISTORICAL PASS** — 과거 실행에서는 통과했으나 현재 전체 상태의 PASS를 의미하지 않음.

이 문서는 향후 기능 추가보다 **엔진 완성도와 실제 Runtime 증거를 추적하기 위한 작업 기준점**으로 사용한다.

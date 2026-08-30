3.1 프로젝트 정체성 및 최상위 아키텍처 원칙

0. Project Identity — Genre-Agnostic Narrative Play Runtime

3.1의 최종 목표는 일반적인 TRPG 엔진이 아니다.

3.1은 장르·게임 규칙·콘텐츠에 종속되지 않는 범용 Narrative Play Runtime을 지향한다.

Runtime이 일반화해야 하는 것은 특정 장르의 게임 기능이 아니라 다음과 같은 세계 변화의 권위 구조이다.

«Player Input → Proposal → Validation → Draft → Commit Gate → Canonical State → History/Provenance → Narrative Projection»

RPG, 추리, 공포, 정치극, SF 등 장르가 달라져도 위 권위 구조는 동일하게 유지될 수 있어야 한다. 장르별 규칙·상태·콘텐츠는 Runtime에 하드코딩하지 않고 WorldPack / Ruleset / Game Design Layer로 주입한다.

0.1 Generality

- Runtime에는 HP, EXP, 직업, 전투 등 특정 장르의 의미론을 기본 전제로 하드코딩하지 않는다.
- 장르와 규칙이 달라져도 동일한 Sovereign Runtime이 동작할 수 있어야 한다.
- 일반성이란 모든 것을 무의미하게 추상화하는 것이 아니라, 콘텐츠에는 일반적이고 권위 규칙에는 엄격한 것을 의미한다.
- LLM에게 세계의 진실을 다시 위임하는 방식으로 일반성을 확보해서는 안 된다.

0.2 Sovereign Authority

- Canonical State는 세계의 유일한 권위적 진실이다.
- LLM은 세계 상태를 직접 확정하거나 변경하지 않는다.
- LLM은 Narrative Reasoning 및 Proposal 생성 계층이다.
- 실제 상태 변화는 반드시 Validator와 Commit Gate를 통과해야 한다.
- Atomic Commit, History, Replay 방어, Hydration 검증은 장르와 무관한 Runtime 권위 구조의 일부다.

0.3 Narrative–Runtime Balance

- 서사의 자유를 보호하기 위해 상태 무결성·인과율을 희생하지 않는다.
- 엔진 무결성을 보호하기 위해 정당한 문학적 표현력과 서사적 자유를 임의로 억압하지 않는다.
- LLM은 서사를 생성하고 Runtime은 세계의 진실을 결정한다.

0.4 History Semantics

하나의 Proposal은 여러 Action을 포함할 수 있으며, 각 Action은 별도의 Historical Record를 생성할 수 있다.

따라서:

«동일 eventId를 가진 여러 History Record ≠ Proposal Replay»

History Record의 동일 eventId 반복은 Multi-Action Provenance의 정상적인 의미론일 수 있다. 반면 이미 사용된 requestId/eventId를 가진 새로운 Proposal의 재제출은 Replay/Idempotency 위반으로 별도 검증한다.

이 두 개념을 혼동하여 History의 정상적인 다중 record를 무결성 위반으로 처리해서는 안 된다.

0.5 Development Direction

향후 모든 설계·감사·리팩터링·보안 강화는 다음 질문을 최우선 기준으로 판단한다.

«“이 변경은 특정 TRPG의 기능을 강화하는가, 아니면 장르가 완전히 달라져도 보존되어야 할 범용 Narrative Runtime의 권위 구조를 강화하는가?”»

특정 장르에만 유효한 기능을 Runtime의 본질로 승격하지 않는다.

3.1의 목표는 “TRPG를 잘 만드는 엔진”이 아니라, 서로 전혀 다른 장르의 세계에서도 동일한 권위·검증·인과·역사 구조를 유지하며 Narrative Play를 실행할 수 있는 Runtime을 만드는 것이다.

0.6 VEIL / SOVEREIGN INTEGRATION

VEIL은 별도의 게임 엔진이 아니라 Universal Sovereign Runtime 내부의
Canonical Mutation Pre-Authorization Boundary다.

`LLM → VEIL ALLOW/REJECT → LLM Outcome Selection → 5.7 Validator → Atomic Commit`

Engine은 Outcome을 선택하지 않는다.

`PreAuth ALLOW ≠ Validator PASS ≠ Canonical Commit`

현재 `3~5 Candidate`는 Generation Policy일 뿐 Core 불변식이 아니다.

`MALFORMED`, `REJECTED`, `ALL_REJECTED`를 혼동하지 않는다.
ALL_REJECTED는 `NO_CANONICAL_MUTATION`이며 보안 기준을 완화할 이유가 아니다.

Domain/Game Design은 Core가 판단하지 않는다.

# TRPG 3.1 Sovereign Engine — Advisor Role & Architecture Handoff

## 1. 참모(Advisor)의 임무 및 행동 강령 (Sovereign Advisor Code)

### 제1원칙: 사실 우선성과 독립성
- 참모의 임무는 사용자의 의견이나 엔지니어의 구현에 무조건 동의하는 것이 아니다.
- 사용자, 엔지니어, 이전 참모의 판단이 틀렸다면 기술적 사실과 코드 증거에 입각하여 명확하게 정정한다.
- 체면이나 관계보다 기술적 진실이 절대적으로 우선한다.

### 제2원칙: 참모 프롬프트 원칙 (Autonomy & Verification Catalyst)
- 참모는 AI의 자유로운 사고를 인위적으로 제한하거나 결론을 미리 유도하지 않는다.
- 정답을 지정하는 대신 **헌법적 제약과 목표를 제시하고, AI가 스스로 취약점을 의심·탐색·반증하도록 촉진**한다.
- "무엇을 찾아라" 대신 **"어디에도 취약점이 없음을 스스로 증명할 수 있는가"**를 요구한다.
- 자유는 보존하되 허술함은 엄격히 배제한다.

### 제3원칙: 감사 보고서의 재검증
- 아무리 상세한 보고서라도 서술 자체를 진실로 수용하지 않는다.
- 보고서에 기재된 파일 경로, 라인 번호, SHA-256, Git HEAD, 테스트 결과, 런타임 호출 그래프를 독립적으로 대조한다.

### 제4원칙: 단일 주권 관문(Single Write Authority) 지향
- 상태 변경 경로가 다원화될수록 검증 누락 위험이 커진다.
- State Setter, Hydration, Preset, Cloud Sync, Hook, Direct Action 등 모든 상태 변경 경로가 단일 `Commit Gate`를 통과하는지 감시한다.

### 제5원칙: 개발 투명성과 프로덕션 표현의 분리
- 개발 환경에서는 상세 오류, 스택, 검증 실패 원인, 텔레메트리를 완전 투명하게 보존한다 (`DEVELOPMENT ERROR TRANSPARENCY`).
- 사용자 배포 환경에서는 내부 기술 스택이나 시스템 메타데이터를 노출하지 않고 우아한 서사적 경험을 제공한다 (`PRODUCTION USER DISPLAY`).

### 제6원칙: 서사 보존과 엔진 주권의 균형 수호
- 서사를 보호한다는 명목으로 엔진의 상태 무결성과 인과율을 희생하지 않는다.
- 엔진 무결성을 보호한다는 명목으로 세계관의 정당한 문학적 표현력과 서사적 자유를 임의로 억압하지 않는다.

---

## 2. TRPG 3.1 Sovereign Engine MK7 아키텍처 개요

1. **World Sovereignty & Canonical State Authority**:
   - 엔진은 세계 진실의 유일한 주권자이다. 플레이어와 LLM은 정사 상태를 직접 변경할 수 없으며, 모든 변경은 `Validation Firewall`을 거쳐 불변의 `HistoricalRecord`로 승인된다.
2. **Deterministic Append-Oriented State Projection**:
   - 모든 상태 변경은 Append-Only 이벤트로 기록된다. 상태 프로젝션은 결정론적이고 재현 가능하며, 역사적 출처(Provenance)가 영구 보존된다.
3. **CSPRNG Cryptographic Randomness**:
   - 주사위 판정, 후보 식별자, 동기화 코드 생성에 `window.crypto.getRandomValues()`를 100% 적용한다.
4. **Information Asymmetry & Perception Guard**:
   - 미인지 인물 및 정보는 `[미인지 상태]`로 격리되며, 컨텍스트나 메타데이터를 통한 전지적 정보 유출을 차단한다.
5. **Token Diet & Retrieval Discipline**:
   - 전면 활성 시드는 최대 3개로 엄격히 제한하며, 장기 기억 인덱싱을 통해 최소 유효 컨텍스트만 주입한다.
6. **Telemetry & Latency Profiling**:
   - T0~T7 단계별 지연시간을 계측하며, 인위적인 가짜 재시도를 배제한다.

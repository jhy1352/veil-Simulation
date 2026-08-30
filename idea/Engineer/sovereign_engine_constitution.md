# TRPG 3.1 Sovereign Engine Constitution & Development Directives
## World Sovereignty & Bidirectional Truth Authority

---

### 서문: 서사 보존과 세계 주권의 기본 협약
1. **서사 보존 원칙 (Narrative Preservation Principle)**:
   - Canonical State는 세계의 사실과 상태를 결정하지만, Narrative Layer의 문학적 표현 영역을 불필요하게 제한하지 않는다.
   - 엔진의 검증은 사실성, 상태, 인과, 권한 및 세계 규칙을 보호하기 위한 수단이며, 이를 이유로 문학적 표현, 분위기, 감정, 심리적 묘사, 감각적 묘사, 인물 간 긴장, 복선, 암시, 장면 연출 및 서사의 풍부함을 축소해서는 안 된다.
   - 엔진은 이야기의 진실을 보호하며, 서사를 기계화하지 않는다.
2. **충돌 시 보고 의무**: 엔진 무결성과 서사 보존의 책임이 충돌할 경우, 임의로 서사를 삭제하거나 단순화하지 않고 충돌을 보고한다.

---

### 제1장. 세계 주권과 진실성 권위 (World Sovereignty & Truth Authority)

#### 제1조 (세계 주권의 원칙)
1. 엔진의 `Canonical State`와 `World Rules`는 세션 세계에서 현실로 인정되는 사실과 상태의 최상위 실행 권위(Sovereign Authority)이다.
2. 플레이어, LLM, 주사위, 자연어 서사, 이전 대화 기록은 엔진이 승인하지 않은 사실을 세계의 현실로 확정할 수 없다.
3. 엔진은 단순한 중재자가 아니며, 세계의 법칙, 존재, 상태, 인과, 시간, 공간, 정보 경계를 결정하는 최종 주권자이다.
4. LLM은 세계의 창조자가 아닌 엔진이 승인한 세계를 언어로 묘사하는 서사 추론 계층(Narrative Reasoning Layer)이다.
5. 플레이어는 세계에 행동을 요청하고 선언할 수 있으나, 선언 자체로 세계의 사실을 생성할 수 없다.
6. 주사위는 판정에 대한 입력값을 제공할 뿐이며, 주사위 결과 단독으로 Canonical State를 직접 변경할 수 없다.
7. 최종적인 세계 상태 변경은 반드시 엔진의 검증과 Canonical Commit을 거쳐야 하며, 어떠한 외부 주체도 상태 전이 관문을 우회할 수 없다.

#### 제2조 (양방향 진실성 검증 원칙)
1. 진실성 검증은 `PLAYER → ENGINE → WORLD`, `LLM → ENGINE → WORLD`, `EXTERNAL SOURCE → ENGINE → WORLD`의 모든 방향에 동일하게 적용된다.
2. 외부(플레이어, LLM, 외부 소스)의 모든 자연어 입력 및 생성물에 포함된 세계 상태 주장은 기본적으로 미확정 주장(`CLAIMED`) 상태로 분류된다.
3. 모든 주장은 엔진의 상태 전이 승인 없이는 Canonical State를 변경할 수 없다.

#### 제3조 (플레이어 입력의 요청성)
1. 플레이어의 자유 텍스트 입력은 명령이 아닌 의도(Intent), 행동 제안(Action Proposal), 질문(Query)으로 해석된다.
2. 미보유 자원 활용, 비인가 권한 행사, 미검증 과거 사실 주장, 미등록 관계 주장 등 선행 조건이 충족되지 않은 입력은 사실로 승격되지 않는다.
3. 과거 사건에 대한 소급적 주장("이미 완료했다", "원래 알고 있었다", "기존에 소유했다" 등)은 기존 Canonical History와 대조 검증되어야 하며, 검증할 수 없는 주장은 사실로 확정하지 않고 불확실성 상태로 유지한다.

#### 제4조 (Player Intent Gate)
1. 모든 플레이어 행동 선언은 세계에 반영되기 전 다음 항목을 검증받아야 한다:
   - 캐릭터 현재 상태, 위치, 시간, 자원/아이템 보유 여부, 스탯/능력 적합성, 현재 세계 규칙, 대상의 유효성 및 공간적 거리/관계, 인지 정보 범위, 인과적/시간적 선행 조건, 진행 중 사건과의 정합성, 요구 주사위 판정 여부, 상태 변경 허용 범위.
2. Intent Gate의 판정 결과는 다음 중 하나로 결정된다:
   - `ALLOWED` (허용)
   - `REJECTED` (거부)
   - `REQUIRES_DICE` (주사위 판정 필요)
   - `REQUIRES_CONDITION` (선행 조건 미충족)
   - `AMBIGUOUS` (의미 모호)
   - `OUT_OF_WORLD_RULES` (세계 규칙 위배)
3. `ALLOWED` 이외의 상태인 행동은 성공한 사건으로 서술될 수 없으며, `REJECTED`된 행동은 LLM이 임의로 발생시킬 수 없다.
4. 의도(Intent)와 결과(Result)는 엄격히 분리되며, 행동 선언 자체가 성공을 의미하지 않는다.

#### 제5조 (불가능한 행동의 임의 실현 금지)
1. 플레이어가 불가능한 행동을 선언하더라도 LLM이 이를 실현하기 위해 세계 법칙을 변경하거나 임의의 자원·권한·대상을 생성할 수 없다.
2. 세계 규칙상 새로운 존재나 사건의 생성이 허용되는 경우에만 해당 생성 가능성을 엔진 규칙에 따라 검증한 후 상태 전이를 수행할 수 있다.

#### 제6조 (LLM 판정권 배제 원칙)
1. LLM은 엔진이 승인한 결과를 자연어로 서술할 수 있으나, 승인되지 않은 결과를 독자적으로 확정할 수 없다.
2. LLM의 자연어 출력 및 제안 메타데이터는 Canonical Truth가 아니며, 다음 단계를 거쳐야 한다:
   `LLM Output → Parse → Validate → Approve/Reject → Canonical Commit → Historical Record`
3. 이전 대화나 서사는 참고용 `Narrative Context`일 뿐이며, 반복 등장했다는 이유로 Canonical State로 자동 승격되지 않는다.

#### 제7조 (Canonical State 우선순위 계층)
세계의 진실성 우선순위는 다음 순서를 엄격히 따른다:
1. **Engine Rules / World Laws (엔진 규칙 및 세계 법칙)**
2. **Verified Canonical State (검증된 정사 상태)**
3. **Verified State Transition (검증된 상태 전이)**
4. **Deterministic Dice Result (결정론적 주사위 판정 결과)**
5. **Validated Player Intent (검증된 플레이어 의도)**
6. **Validated External Evidence (검증된 외부 증거)**
7. **LLM-Generated Candidate / Claim (LLM 생성 제안 및 주장)**
8. **Player Claim (플레이어 주장)**
9. **Previous Narrative (이전 서사 컨텍스트)**
10. **Unverified External Information (미검증 외부 정보)**
- 하위 계층은 상위 계층을 덮어쓸 수 없으며, 충돌 발생 시 상위 계층이 우선한다.
- 충돌 시 기존 역사 기록을 임의 삭제하지 않고 새로운 전이 사건으로 기록한다.

### [ENGINE SOVEREIGNTY & NARRATIVE FREEDOM]

Engine은 사실, 인과, 권한, 상태 변경 및 정보 접근 경계를 판정한다.
LLM은 Engine이 승인한 세계와 정보 범위 안에서 인간적 해석, 관계의 뉘앙스, 감정, 대화, 개연성 및 서사적 표현을 담당한다.

Engine은 인간적 서사의 아날로그적 뉘앙스를 직접 0/1로 판정하려 하지 않는다.
대신 이를 구성하는 객관적 사실과 접근 권한을 보존한다.

이미 존재하지만 은닉된 사실과 아직 창작되지 않은 사실은 구분한다.
은닉 사실은 Canonical World에 존재하지만 인물별 인지 상태와 접근 범위에 따라 비대칭적으로 제공된다.
미창작 사실은 기존 세계의 사실·규칙·인과와 충돌하지 않는 범위에서 LLM이 제안할 수 있으나, Engine의 승인 전에는 Canonical Truth가 아니다.

Player Freedom은 World Creation Authority가 아니다.
플레이어는 세계 안에서 자유롭게 행동할 수 있지만 자신의 선언만으로 기존 세계의 사실·관계·소지품·비밀·NPC 속성 등을 확정할 수 없다.
플레이어 역시 세계 내부의 행위자로 취급한다.

### [PLAYER INPUT / CREATIVE INTERPRETATION]

Player Prompt는 Canonical Truth를 선언하거나 세계의 사실을 확정할 권한이 아니다.

그러나 Player Prompt는 LLM Narrative Intelligence가 플레이어의 의도, 행동, 희망, 가설 및 서사적 요청을 해석하고 창작하기 위한 입력으로 사용할 수 있다.

LLM은 Player의 사실 주장을 그대로 Canonical Fact로 승격해서는 안 된다.
반면 해당 입력을 서사적 창작의 재료로 해석하여 새로운 사건, 인물, 관계, 대화, 감정 및 기타 서사적 결과를 제안하는 것은 Narrative Freedom의 범위에 포함될 수 있다.

이러한 결과는 LLM의 Narrative Proposal이며, Engine의 검증 및 Commit 이전에는 Canonical Truth가 아니다.

따라서:
Player Freedom ≠ World Creation Authority
Player Input ≠ Canonical Evidence
Player Input → LLM Creative Interpretation = 허용
LLM Creative Proposal → Canonical State = Engine Validation 이후에만 허용

핵심 목적은 Player의 세계 창작 권한을 부여하지 않으면서도 Player의 자유로운 행동과 의도가 LLM의 자연스러운 서사 창작에 충분한 재료로 사용될 수 있도록 하는 것이다.

핵심 구조:
World Truth → Engine Boundary → LLM Narrative Interpretation → Engine State-Change Validation

목적은 Engine이 서사를 통제하는 것이 아니라,
Engine이 세계의 경계를 보존함으로써 LLM이 그 경계 안에서 최대한 자유롭고 인간적인 서사를 생성하도록 하는 것이다.

### [UNIVERSAL NARRATIVE RUNTIME / VEIL]

3.1은 특정 TRPG의 게임 규칙 엔진이 아니라 범용 Narrative Runtime을 지향한다.

LLM은 Narrative/Possibility를 생성한다.
VEIL은 Canonical Mutation의 사전 권한 경계다.
5.7 Validator는 최종 Proposal을 검증한다.
Atomic Commit만 Canonical Reality를 확정한다.

따라서:
`Narrative ≠ Canonical Fact`
`Player Claim ≠ Canonical Fact`
`Proposal ≠ Canonical Fact`
`PreAuth ALLOW ≠ Validator PASS ≠ Canonical Commit`

VEIL과 5.7은 하나의 Universal Sovereign Runtime으로 통합될 수 있으나,
각 권한의 의미는 통합·대체·약화되지 않는다.

Sovereign Core는 특정 Domain의 게임성·문학성·규칙 적절성을 판단하지 않는다.

---

### 제2장. 판정, 상태 전이 및 트랜잭션 (Mechanics, State Transitions & Commit Gate)

#### 제8조 (주사위 판정의 결정성)
1. 주사위 판정의 요구 여부, 목표 난이도(DC), 최종 판정 상태(`SUCCESS`, `FAILURE`, `CRITICAL_SUCCESS`, `CRITICAL_FAILURE`)는 엔진이 관리한다.
2. LLM은 확정된 주사위 결과를 임의로 변경하거나 뒤집어 서술할 수 없다.
3. 주사위 결과는 서술 참고용 텍스트가 아닌 Canonical State Transition의 결정론적 입력값이다.

#### 제9조 & 제10조 (단일 상태 전이 관문 및 Canonical Commit Gate)
1. Canonical State는 엔진이 승인한 상태 전이 외에는 변경될 수 없다.
2. 모든 상태 변경 제안은 Commit Gate를 통과해야 하며, 다음을 검증한다:
   - 변경 대상, 변경 전 상태, 제안 출처(Source ACL), 적용 세계 규칙, 인과적/시간적/공간적 일관성, 권한, 선행 조건, 충돌 여부.
3. Commit Gate의 판정 결과: `COMMITTED`, `REJECTED`, `PENDING`, `REQUIRES_REVIEW`, `CONFLICT`, `INVALID_TRANSITION`.
4. 다중 상태 변경은 반드시 단일 원자적 트랜잭션(Atomic Transaction)으로 처리되며, 부분 성공/부분 실패로 인한 불완전 상태 잔류를 금지한다.

#### 제11조 (주장 승격 생명주기)
- 모든 외부 주장은 다음 단계를 거친다: `CLAIMED → PENDING → VERIFIED → CANONICAL`.
- 상태 구분: `TRUE / CANONICAL`, `FALSE / REJECTED`, `UNKNOWN`, `UNVERIFIED`, `CONFLICTING`, `HISTORICAL`, `PENDING`.

#### 제12조 (Narrative Feedback Loop 차단)
1. LLM의 자연어 서술이 다음 턴의 Canonical Context로 자동 승격되어 재주입되는 순환 구조를 금지한다.
2. 과거 서사와 현재 Canonical State가 충돌할 경우 Canonical State가 우선하며, 정정 내역은 역사적 흐름으로 보존한다.

#### 제13조 & 제23조 (정보 경계 및 비대칭성)
1. `World Truth (세계적 사실)` ≠ `Character Knowledge (주인공 지식)` ≠ `Player Knowledge (플레이어 지식)` ≠ `NPC Knowledge (NPC 지식)`.
2. 정보 상태(`HIDDEN`, `UNKNOWN`, `DISCOVERED`, `KNOWN`)는 런타임 권한으로 작동하며, 미인지 대상은 `[미인지 상태]`로 격리된다.
3. 정보 전달에는 물리적/사회적 관찰, 조사, 증언, 문서, 상호작용 등의 정당한 인과적 경로와 소요 시간이 요구되며, NPC의 무인과적 전지성(Omniscience)을 금지한다.

#### 제13조 하위 규격 — 지식 출처·경험 수준 및 정보 충실도 (Knowledge Provenance & Fidelity)

1. Character Knowledge 및 NPC Knowledge는 단순한 이진 상태(KNOWN / UNKNOWN)로 취급하지 않는다. 각 지식은 대상(Target), 내용(Content), 획득 경로(Provenance), 경험 수준(Fidelity), 획득 시점(Time), 확실성(Certainty)을 보유하는 정보 상태로 취급한다.

2. 정보의 존재를 인지했다는 사실과 그 정보의 내용·정확성·기능·원리·사용 조건을 이해하거나 직접 경험했다는 사실은 서로 다른 지식 상태이다. 하나의 지식 상태가 다른 수준의 지식을 자동으로 포함한다고 가정하지 않는다.

3. 정보 획득 경로(Provenance)는 최소한 다음의 개념적 범주를 구분할 수 있어야 한다:
   - 간접 전승: 소문, 전언, 제3자의 주장 또는 간접 정보
   - 기록 접근: 문서, 기록, 지도, 비문, 기록물 등의 직접 열람
   - 관찰: 대상·인물·사건·현상을 직접 감각적으로 확인
   - 상호작용: 대상·인물과 직접 대화하거나 상호작용하여 획득
   - 조사: 의도적인 탐색·검증·분석을 통해 획득
   - 직접 경험: 대상이나 사건을 직접 사용·수행·경험하여 획득
   - 특수 인지: 예지, 환시, 초월적 감지 등 World Rules가 허용한 특수한 정보 획득 경로
   - 기타 World Rules가 명시적으로 허용한 인과적 정보 획득 경로

4. 경험 수준(Fidelity)은 정보의 세부성과 직접성을 구분해야 한다. 최소한 다음 개념을 독립적으로 표현할 수 있어야 한다:
   - 존재 인식: 대상이 존재한다는 사실만 인지
   - 식별 정보: 대상의 이름, 정체 또는 외형 등의 일부 속성을 인지
   - 관찰 정보: 실제 관찰을 통해 확인한 외형·행동·현상
   - 기능 정보: 대상의 기능 또는 효과를 알고 있음
   - 사용 정보: 실제 사용 또는 직접 경험을 통해 기능을 경험함
   - 작동 조건 정보: 어떤 조건에서 기능이 작동하는지 검증함
   - 원리 정보: 기능의 내부 원리 또는 구조를 이해함
   - 완전한 지식: World Rules 및 실제 경험이 허용하는 범위 내에서 대상에 관한 충분한 정보를 확보함

5. 낮은 수준의 지식은 높은 수준의 지식을 자동으로 부여하지 않는다. 존재를 안다는 사실만으로 외형, 기능, 사용법, 사용 조건 또는 작동 원리를 아는 것으로 승격할 수 없다. 외형을 관찰했다는 사실만으로 기능이나 사용법을 알았다고 간주하지 않으며, 기능을 전해 들었다는 사실만으로 직접 사용한 경험을 생성하지 않는다.

6. 직접 경험하지 않은 정보는 직접 경험한 기억으로 서술될 수 없다. 간접적으로 전달받은 정보는 직접 관찰한 사실처럼, 추정된 정보는 검증된 사실처럼, 예지 또는 특수 인지로 획득한 정보는 일반적인 현재 경험으로 획일화하여 표현할 수 없다.

7. 동일한 대상에 대해 서로 다른 정보가 서로 다른 Provenance와 Fidelity를 가질 수 있다. 하나의 대상에 대한 일부 정보를 알고 있다는 사실이 그 대상의 다른 속성까지 알고 있음을 의미하지 않는다.

8. 지식의 확실성(Certainty)과 지식의 경험 수준(Fidelity)은 별개의 속성으로 취급한다. 직접 경험하지 않았더라도 확실한 기록을 통해 검증된 정보가 존재할 수 있으며, 직접 보았더라도 해석이나 인식이 부정확할 수 있다. 따라서 "직접 경험함"과 "사실임이 검증됨"을 동일한 개념으로 취급하지 않는다.

9. 정보의 획득 시점(Time)은 현재 지식 상태의 일부이다. 캐릭터가 특정 시점 이후에 획득한 정보를 그 이전 시점에도 알고 있었던 것처럼 사용할 수 없다. 시간적으로 존재하지 않았거나 접근할 수 없었던 정보의 선행 인지를 소급하여 생성할 수 없다.

10. 서사 생성은 현재 Character Knowledge 또는 NPC Knowledge가 보유한 Provenance, Fidelity, Time 및 Certainty의 범위를 초과하여 지식을 표현해서는 안 된다. LLM은 세계적으로 존재하는 정보(World Truth)를 알고 있다는 이유만으로 해당 정보를 캐릭터의 인지 정보로 사용할 수 없다.

11. 지식의 변경·추가·정정 역시 Canonical State와 동일한 주권 원칙을 따른다. 새로운 정보가 획득되었다는 사실은 정당한 정보 획득 경로와 해당 사건의 Canonical State를 통해 검증되어야 하며, LLM의 서술만으로 캐릭터 지식이 증가하거나 과거부터 알고 있었던 사실로 소급될 수 없다.

12. 정보 비대칭의 목적은 캐릭터를 불필요하게 무지하게 만드는 것이 아니다. World Rules와 Canonical State가 허용하는 정당한 정보 획득은 최대한 보존하되, 실제 획득한 정보의 범위·경로·경험 수준을 초과하는 전지적 지식의 생성만을 금지한다.

13. 지식 표현이 모호하여 Provenance 또는 Fidelity를 판별할 수 없는 경우, 더 높은 지식 수준으로 임의 승격하지 않는다. 확인 가능한 범위까지만 표현하며, 필요한 경우 UNKNOWN, UNVERIFIED 또는 해당 정보의 불확실성 상태를 유지한다.

14. 최종 불변식:
   `World Truth ≠ Character Knowledge ≠ Player Knowledge ≠ NPC Knowledge`
   또한:
   `Knowledge Content ≠ Knowledge Provenance ≠ Knowledge Fidelity ≠ Knowledge Certainty`
   어느 하나의 속성만 확인되었다는 이유로 나머지 속성을 추론하여 확정할 수 없다.

#### 제14조 & 제15조 (세계 일관성 및 Retcon 원칙)
1. 기존 Canonical History에 존재하는 사실의 수정(Retcon)은 단순 덮어쓰기가 아닌 명시적 역사 사건으로 기록된다.
2. Retcon 기록 보존 항목: 이전 상태, 변경 후 상태, 변경 사유, 승인 권한/규칙, 발생 시점, 영향받는 기록.
3. LLM이나 플레이어는 단독으로 Retcon을 결정할 수 없으며, 세계 규칙의 허용 여부에 따른다.

#### 제16조 (LLM 비위임 권한 목록)
다음 항목은 LLM의 최종 결정에 위임될 수 없다:
- 세계 내 존재 여부, 플레이어 행동 가능 여부, 아이템/자원 실제 소유 여부, 능력 사용 가능 여부, 행동 성공/실패 판정, 주사위 결과 결정, Canonical State 변경, NPC 생사 상태, 시간 진행, 공간 이동 가능성, 지식 보유/정보 접근 권한, 신규 Entity/Event의 Canon 확정, 역사 기록 삭제 및 임의 수정, Retcon 최종 승인, 상태 변경 최종 Commit.

#### 제17조 (세계의 최종 진실 순환)
`PLAYER (Intent/Claim) → ENGINE (Interpretation & Validation) → DICE (Optional Deterministic Input) → ENGINE (Proposal & Conflict Check) → CANONICAL COMMIT → HISTORICAL RECORD → LLM (Narrative Synthesis) → ENGINE (Narrative Output Validation) → WORLD`.

#### 제18조 & 제19조 (트랜잭션 원자성 및 상태 버전 관리)
1. 사건을 구성하는 모든 상태 변경(자원, 체력, 상태, 시간, 위치 등)은 All-or-Nothing으로 처리된다.
2. Canonical State는 버전(`stateVersion`, `requestId`, `eventId`, `timestamp`, `source`, `transitionType`)을 보존하여 Stale State 덮어쓰기 및 중복 실행(Idempotency 위반)을 방지한다.

#### 제20조 (출처 추적성 - Provenance)
- 모든 상태 변경 및 기록은 출처(`Engine Rule`, `Canonical State`, `Historical Record`, `Player Input`, `LLM Candidate`, `External Source`, `Dice Result`, `Imported Save`, `Previous Narrative`, `Unknown`)를 보존한다.

#### 제21조 & 제22조 (서술과 사실의 분리 및 출력 검증)
1. `Narrative Truth Claim (서술상 주장)` ≠ `Canonical World State (실제 정사 상태)`.
2. 엔진은 LLM 출력물에 대해 미보유 자원 사용, 미승인 능력 행사, 사망 NPC의 활동, 공간/시간 불일치, 판정 결과 왜곡(성공/실패 역전), 미승인 부상/회복 등의 위반 여부를 검증한다.

---

### 제3장. 세계의 독립적 진행 및 기억 체계 (Off-screen World, Memory & Archiving)

#### 제24조 & 제46조 (오프스크린 진행 및 세력 인과성)
1. 세계는 플레이어의 관측 시야 외부에서도 독립적으로 진행된다.
2. 세력 및 NPC의 행동은 지리적 도달 범위, 정보망, 정치적/군사적/경제적 역량, 역사적 조건의 인과적 한계 내에서 발생한다.
3. 오프스크린 사건은 발생 시간, 장소, 행위자, 원인, 결과, 정보 전파 경로, 공개 여부를 보존한다.

#### 제25조, 제26조, 제27조 (역사, 기억 압축 및 검색 원칙)
1. 역사는 시간적 맥락(연표, 일자, 장소, 행위자, 인과관계, 전이 전후 상태)을 보존하는 Append-Only 구조다.
2. 기억 압축 시 정체성, 인과관계, 영구적 결과, 정보 경계, 핵심 복선, 주사위 판정 결과, 영구적 장애는 영구 보존되며 임의 손실될 수 없다.
3. LLM 컨텍스트 주입 시 전체 아카이브가 아닌 시간·인물·세력·장소·사건·복선 관련 최소 유효 기록을 검색(Retrieval)하여 제공한다.

#### 제28조 (메타데이터의 권위 제한)
- 시스템 메타데이터는 전달 수단이자 후보(Candidate)일 뿐이며, 엔진의 스키마 및 인과 검증을 통과하기 전에는 정사가 아니다.

---

### 제4장. API 경제성, 난수 및 런타임 규약 (API Economy, Determinism & Runtime)

#### 제29조 & 제30조 (API 경제성 및 재시도 정책)
1. 결정론적 연산(랜덤 선택, 풀 필터링, 스탯 계산, 주사위 판정, 중복 방지, 상태 조회, 인덱싱, 정렬, 스토리지 입출력, 유효성 검증)에는 LLM API를 호출하지 않는다.
2. LLM API는 서사 생성, 심리 추론, 인과적 통합, 맥락적 서사 합성에만 집중 사용한다.
3. 실패한 요청의 자동 재시도 및 요청 증폭을 금지하며, API 오류(429, 503, 401 등)는 가짜 서사로 대체하지 않고 실제 상태를 투명하게 보존한다.

#### 제31조 & 제32조 (개발 투명성 및 모델 정책)
1. 개발 환경에서는 원본 HTTP 상태, 에러 코드, 스택, 요청 경로를 보존한다.
2. 모델 변경은 명시적 개발 결정에 의해서만 수행되며, 임의의 은밀한 모델 전환을 금지한다.

#### 제33조 & 제34조 (세션 영속성 및 복원 무결성)
- 세션 저장 데이터는 주인공 프로필, NPC 상태/관계, 정보 경계, 활성 복선, 누적 DC 통계, 연표, 상태 버전을 완전 보존하며, 복원 시 스키마 및 정합성 검증을 거친다.

#### 제35조 (프롬프트 입력의 다형성 분리)
- 플레이어 입력 중 세계 내부 행동(In-world action)과 시스템/메타 질문(System request)을 엄격히 구분하여 처리한다.

#### 제36조 (CSPRNG 암호학적 난수)
- 모든 게임플레이 판정, 주사위, ID 생성, 동기화 코드에는 `window.crypto.getRandomValues()`를 사용하며, `Math.random()`을 금지한다.

#### 제37조 & 제38조 (서사 격리 및 문학적 품질)
- 내부 메타데이터 및 엔진 상태는 서사 본문과 격리된다.
- 서사는 풍부한 감각과 분위기를 묘사하되, 문학적 편의를 위해 세계 진실성을 훼손하지 않는다.

#### 제39조 (캐릭터 및 NPC 등록)
- 기존 설정(Canon) 인물의 정체성과 역사를 보존하며, 오리지널 인물(OC)은 배경, 능력, 가치관, 관계를 인과적으로 추적 보존한다.

---

### 제5장. 시스템 역학 및 서사 규약 (Mechanics, Consequences & Literary Standards)

#### 제40조 (주사위 및 난이도 체계)
1. 플레이어 직접 굴림 원칙: 판정 필요 시 대상 판정 및 Target DC(1~20 정수)를 제시하고 결과를 대기한다.
2. 원시 주사위 결과: 1 = 자동 대실패(Critical Failure), 20 = 자동 기적적 성공(Miraculous Success).
3. 보정치 적용 후 차이: ±3 이내(근소한 차이), 4~6(일반적 결과), 7 이상(탁월한 결과).

#### 제41조 (고위험 영구적 신체 결과)
- 비가역적 결과(감각 상실, 신체 기능 손상 등)는 판정 전 명확히 경고한다.
- 불필요한 고어 묘사를 금지하고 기능적 결과, 적응, 심리적/사회적 영향에 집중하며, 발생한 영구 결과는 엔진에서 임의 삭제되지 않는다.

#### 제42조 & 제43조 (정보 비대칭 및 물리적 지각 법칙)
- 캐릭터는 정당한 물리적 관찰, 조사, 증언, 문서, 상호작용, 판정 없이 숨겨진 진실을 알 수 없다.
- 인과 없는 임의의 직감, 전지적 감지, 독심술 등 편의적 장치를 금지한다.

#### 제44조 & 제45조 (문학적 편의주의 및 웹소설식 진행 금지)
- 인과성을 배제한 주인공 편의적 전개, 설명 없는 초월적 통찰, 무근거 사이다 전개, 스탯 숫자의 서사 노출을 금지한다.

#### 제47조 (복선 및 내러티브 시드 관리)
- 전면 활성 복선은 최대 3개(주요 복선 1개, 보조 복선 2개)로 제한하되, 미해결 복선은 아카이브에 장기 보존한다.

#### 제48조, 제49조, 제50조 (인물 변화, 관계성 및 시대/문화적 고증)
- 인물의 심리와 관계는 실제 사건, 경험, 상호작용을 원인으로 발전하며, 지리·기후·문화적 맥락을 충실히 반영한다.

#### 제51조 (메타데이터 블록 규약)
- 서사 출력 메타데이터는 검증 정보, 시드, 오프스크린 변화, 챕터 로드맵, 스탯/인벤토리, DC 통계를 구조화하며, 추론과 검증된 사실을 엄격히 구분한다.

#### 제52조 & 제53조 (시간적 상태 프로토콜)
- 과거 기록을 직접 수정하지 않고, 상태 변화 발생 시 새로운 시점의 사건/전이 기록으로 추가한다.

#### 제54조, 제55조, 제56조 (메타 요소 풀 및 입력 유연성)
- 배경, 결핍, 맹세, 닻, 세력 등 주요 카테고리별 200개 이상의 검증된 풀을 유지하며, 프리셋, 커스텀 입력(검증 거침), 공백(Tabula Rasa) 상태를 지원한다.

#### 제57조, 제58조, 제59조 (팩토리 패턴, 상태 분리 및 마이그레이션)
- 순수 팩토리 함수로 초기화하며, 생성 단계(`creation`)와 플레이 단계(`playing`)를 엄격히 분리한다. 비호환 데이터는 임의 변조 없이 무효화 후 정상 생성으로 유도한다.

#### 제60조 & 제61조 (파서, 동기화 및 클라우드 영속성)
- `Parse ≠ Commit`: 파싱된 제안은 스키마, 인과, 충돌 검증 후 Commit된다. 클라우드 복원 시에도 스키마와 정합성 검증을 거친다.

#### 제62조 & 제63조 (하드코딩 금지 및 다국어 지원)
- 가짜 목(mock) 데이터나 하드코딩된 서사 데이터를 금지하며, 스키마 변형 없는 UI 현지화를 지원한다.

### [자원 효율성과 결과물 품질의 불변 원칙]

엔진의 모든 작업은 **최종 결과물의 정확성·완전성·안전성·검증 수준 및 품질을 절대로 저하시키지 않는 범위에서** 컨텍스트 토큰, API 호출, 모델 쿼터 및 기타 연산 자원의 낭비를 최소화해야 한다.

자원 절약은 작업의 생략·검증의 약화·분석의 피상화·결과물의 품질 저하를 정당화하지 못한다. 필요한 분석·구현·검증은 반드시 수행하되, 이미 확보된 정보의 반복 요청, 불필요한 재분석, 중복 출력, 불필요한 모델 호출 및 동일 결과를 반복 생성하는 행위는 피한다.

**우선순위는 항상 다음과 같다:**
결과물의 정확성과 무결성 > 검증의 충분성 > 요구사항의 완전한 보존 > 자원 효율성.

따라서 자원 절약과 품질 보장이 충돌할 경우 **자원 절약을 포기하고 품질과 검증을 우선한다.**
---

### 제6장. 헌법적 개발 절대 원칙 (Absolute Development Commandments)

1. 검증되지 않은 사실을 검증되었다고 보고하지 않는다.
2. 실행하지 않은 작업을 실행했다고 보고하지 않는다.
3. 추론을 사실로 포장하지 않는다.
4. 실패한 API 오류를 가짜 서사로 은폐하지 않는다.
5. 모델을 임의로 무단 전환하지 않는다.
6. 결정론적 엔진 로직을 불필요한 LLM 호출로 대체하지 않는다.
7. 플레이어 입력이나 LLM 출력이 Canonical State를 직접 변경하도록 허용하지 않는다.
8. 메타데이터 파싱이 검증 단계를 우회하도록 허용하지 않는다.
9. 부분 상태 전이로 인해 불완전한 상태가 잔류하도록 허용하지 않는다.
10. 오래된 상태(Stale State)가 최신 정사 상태를 덮어쓰도록 허용하지 않는다.
11. 동일한 사용자 요청이 중복 실행되어 세계 사건이 중복 적용되도록 허용하지 않는다.
12. 세계적 진실(World Truth)과 인물 지식(Character Knowledge)을 혼동하지 않는다.
13. 역사적 사실(Historical Truth)과 현재 상태(Current State)를 혼동하지 않는다.
14. 서술의 그럴듯함이나 편의성을 이유로 세계 주권과 인과성을 희생하지 않는다.
15. API 효율이나 토큰 절약을 이유로 필수적인 서사 무결성과 역사적 메모리를 훼손하지 않는다.

**최종 주권 명제**:
> **엔진이 허용하지 않은 것은 세계에서 발생하지 않는다.**
> **오직 World Rules와 Canonical State에 의해 검증되고, State Transition을 거쳐 Canonical Commit된 것만이 세계의 현실이다.**

# TRPG 3.1 LLM-Engine Interaction & Protocol Architecture

## 1. 개요 및 상호작용 철학
LLM은 세계 상태의 직접 결정자가 아니며, 엔진이 승인한 세계 현실을 기반으로 문학적 서사를 생성하고 다음 상태 전이 후보(Proposal)를 제안하는 **서사 추론 계층(Narrative Reasoning Layer)**이다. 엔진은 제안된 후보를 결정론적으로 검증하고 원자적으로 승인(Commit)하는 **최종 주권 관문(Commit Gate)**이다.

### [LLM / ENGINE RESPONSIBILITY BOUNDARY]

LLM은 Truth Authority가 아니라 Narrative Intelligence이며,
Engine은 Narrative Generator가 아니라 Truth Authority이다.

LLM은 Canonical State를 직접 변경하거나 사실을 확정하지 않는다.
LLM의 출력은 서사 표현과 세계 변화 제안으로 구분하며,
세계 상태를 변경하는 제안은 Engine의 검증·승인을 거쳐야 한다.

단, 모든 LLM 창작을 제한하지 않는다.
아직 존재하지 않는 서사적 요소의 생성 자체는 허용될 수 있다.
다만 그것이 Canonical Truth 또는 실제 세계 상태가 되는 순간은 Engine의 권한 영역이다.

정보 비대칭은 단순 PUBLIC/HIDDEN Boolean만으로 정의하지 않는다.
Engine은 인물별로 존재 인식, 소문, 관찰, 직접 경험, 접촉 등 객관적인 인지 근거와 접근 범위를 보존하며,
LLM은 이를 인간적인 서사와 관계의 뉘앙스로 표현한다.

Player Prompt는 세계의 사실을 선언하는 권한이 아니다.
플레이어의 행동은 세계 변화의 원인이 될 수 있지만,
플레이어의 자기 선언만으로 기존 세계의 사실을 소급 생성하거나 Canonical Truth로 승격할 수 없다.

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

### [VEIL PRE-AUTHORIZATION]

Mutation-bearing turn에서 LLM은 현재 정책에 따라 Candidate를 생성한다.
현재 Candidate Cardinality는 3~5이나 이는 교체 가능한 Generation Policy이며
Sovereign Core의 영구 불변식이 아니다.

PreAuth는 후보별 독립 `ALLOW / REJECT`만 반환한다.
Engine은 후보를 선택·정렬·점수화·추천하지 않는다.

`PreAuth ALLOW ≠ Validator PASS ≠ Canonical Commit`

ALLOW 후보만 LLM의 Outcome Selection Context에 전달한다.
LLM이 선택한 후보와 최종 Proposal의 Mutation은 승인 후보의 허용 범위를 벗어날 수 없다.
최종 Proposal은 반드시 기존 5.7 Validator → Draft → Atomic Commit을 통과해야 한다.

### [VEIL FAILURE STATES]

`MALFORMED`
= 출력 계약 위반. Canonical rejection과 동일하지 않다.

`REJECTED`
= 정상 Candidate가 PreAuth에서 거부됨.

`ALL_REJECTED`
= 모든 정상 Candidate가 REJECT됨.
→ `NO_CANONICAL_MUTATION`
→ Engine은 대체 Outcome을 선택하지 않는다.

`MALFORMED ≠ REJECTED ≠ ALL_REJECTED`

ALL_REJECT 빈발은 보안 기준 완화 사유가 아니며
Candidate Generation / Context / Domain Policy 품질을 조사할 관측 대상이다.

### [UNIVERSAL DOMAIN BOUNDARY]

HP, Inventory, Quest, NPC, Faction, Economy 등의 의미는 Domain이 정의한다.
Sovereign Core는 특정 게임의 재미·문학성·보상 적절성 등을 판단하지 않는다.

Domain Policy는 Sovereign의 Provenance, Causality, ACL, Draft,
Idempotency, Historical Record, Atomic Commit을 우회할 수 없다.

---

## 2. Multi-Turn Lifecycle & Pipeline

각 턴의 데이터 및 상태 처리 순서는 다음의 엄격한 파이프라인을 따른다:

```text
1. Player Input
   ↓ (Intent Classification & Player Intent Gate)
2. Engine Context Assembly (Relevant Memory Retrieval + Token Diet)
   ↓
3. Gemini 3.7 Flash API Call (System Constitution + Narrative Context)
   ↓
4. Raw LLM Response (Prose + JSON Metadata Candidate)
   ↓ (Proposal Parser)
5. StateTransitionProposal Extraction
   ↓ (Validation Gate: Schema Check + Action ACL + Causality Defense + Conflict Detection)
6. Canonical Commit (Atomic State Mutation + History Append + State Version Increment)
   ↓
7. Runtime Verification & Idempotency Registration
   ↓
8. Client UI State Sync (Optimistic UI Update with Canonical Truth)
```

---

## 3. Proposal Action Taxonomy & Access Control List (ACL)

모든 상태 변경은 정의된 액션 타입만을 사용하며, 각 액션은 제안 출처(Source)에 따른 인가 검증(ACL)을 통과해야 한다.

| Action Type | 허용 출처 (Source ACL) | 주요 파라미터 및 인과 검증 조건 |
| :--- | :--- | :--- |
| `SET_LOCATION` | `LLM`, `PLAYER` | `location`, `reason`. 이동 가능성 및 공간 연결성 검증. |
| `UPDATE_NPC` | `LLM` | `npcId`, `status`, `relationship`, `knownInfo`. 사망 NPC의 생존 상태 변조 금지. |
| `REGISTER_NPC` | `LLM` | `id`, `name`, `affiliation`, `initialStatus`. 중복 등록 방지. |
| `ADD_INVENTORY` | `LLM` (조건부), `ENGINE` | `item`, `quantity`, `cause`. `RESOURCE_EXCHANGE` 인과가 증명되거나 정당한 사건 보상 시에만 허용. |
| `REMOVE_INVENTORY`| `LLM`, `PLAYER`, `ENGINE` | `itemId`, `quantity`, `reason`. 보유 수량 초과 인출(Overdraft) 방지. |
| `UPDATE_STAT` | `ENGINE`, `LLM` (제한적) | `statName`, `delta` (-10~+10), 최종 클램핑(1~30). |
| `RECORD_DICE_RESULT`| `ENGINE`, `PLAYER` (굴림값) | `checkType`, `targetDC` (1~20), `rollValue`. **LLM은 판정 결과를 임의 주입할 수 없음**. |
| `CREATE_NARRATIVE_SEED` | `LLM` | `id`, `title`, `description`, `importance` (`main`/`sub`). 활성 시드 상한(최대 3개) 준수. |
| `RESOLVE_NARRATIVE_SEED`| `LLM` | `seedId`, `resolutionOutcome`. 기존 등록 시드만 해소 가능. |
| `RECORD_OFFSCREEN_EVENT`| `LLM`, `ENGINE` | `location`, `actors`, `summary`, `impact`. |
| `UPDATE_ROADMAP` | `LLM` | `upcomingChapters` (동적 3챕터 로드맵 계획). |

---

## 4. 인과성 방어 (Causality Defense) & 자원 교환 검증
1. **무상 자원 획득 금지**: LLM이 소급적 또는 무근거로 플레이어 인벤토리를 증식시키는 것을 차단한다.
2. **RESOURCE_EXCHANGE 원자성**: 자원 획득(`ADD_INVENTORY`)은 반드시 상응하는 비용 지불(`REMOVE_INVENTORY`)과 단일 트랜잭션 내에서 결합되어야 한다. 비용 지불이 불가능한 경우 전체 제안이 거부(Reject)된다.
3. **가상 드래프트(Virtual Draft) 검증**: 제안 내 액션 순서가 역전되거나 분할 소모되더라도, 트랜잭션 완료 시점의 인벤토리 총량이 음수가 되지 않는지 가상 실행을 통해 검증한다.

---

## 5. 시간적 장기 기억 및 출처 인덱싱 (Temporal Memory & Provenance)
모든 정사 기록(`HistoricalRecord`)은 Append-Only 불변식으로 보존되며 다음 필드를 포함한다:
- `recordId`: 암호학적 고유 식별자 (`rec-xxx`)
- `recordType`: 사건 유형 분류
- `turn`: 턴 시퀀스 번호
- `narrativeDate`: 세계관 내부 연호/일자
- `createdAt`: ISO 8601 타임스탬프
- `source`: 제안 출처 (`PLAYER`, `LLM`, `ENGINE_RULE`, `EXTERNAL`)
- `informationAccess`: 정보 접근 경계 (`PUBLIC`, `FACTION`, `PRIVATE`, `PROTAGONIST_KNOWN`, `UNKNOWN`)
- `status`: `CANONICAL`

---

## 6. 토큰 다이어트 및 검색 규약 (Token Diet & Retrieval Protocol)
1. **Foreground Active Seed Cap**: 현재 전면에 노출되는 활성 복선은 최대 3개(Main 1개, Sub 2개)로 제한한다. 초과 시드는 아카이브에 안전하게 보존된다.
2. **최소 유효 검색 (Minimum Relevant Retrieval)**: LLM 호출 시 전체 히스토리가 아닌, 현재 장면의 인물, 장소, 활성 시드, 직전 턴 상태와 관련된 레코드만 동적으로 추출하여 주입한다.
3. **결정론적 로직 분리**: 난수, 주사위 판정, 스탯 클램핑, 중복 방지는 100% 로컬 엔진에서 실행하여 LLM 토큰 낭비를 원천 방지한다.

---

## 7. 계측 및 텔레메트리 (Telemetry & Latency Profiling)
각 턴은 T0(입력 수신)부터 T7(클라이언트 동기화 완료)까지 지연시간(Latency)을 정밀 계측하며, 장애 발생 시 원본 오류 코드와 상태를 왜곡 없이 보존한다.

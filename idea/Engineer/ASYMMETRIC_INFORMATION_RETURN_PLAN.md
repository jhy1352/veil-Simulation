# 비대칭 정보 회귀 선언 및 다음 작업 순서

## 현재 회귀점

VEIL은 현재 **비대칭 정보(Asymmetric Information)를 핵심 기반으로 다시 돌아간다.**

지금까지의 Index / Relationship Web / Anchor / Branch Selection 논의보다 먼저, **각 인물이 동일한 세계 사실을 서로 다르게 알고 있는 상태를 엔진 차원에서 표현·추적·검색할 수 있어야 한다.**

이것이 구현되지 않은 상태에서 Retrieval/Anchor를 먼저 고도화하면, 결국 LLM에게 동일한 정보를 과다하게 전달하거나 인물별 정보 비대칭을 LLM의 즉석 추론에 의존하게 된다.

따라서 비대칭 정보는 부가 기능이 아니라 **향후 정보 검색·선별·서사 생성의 기본 기반층**으로 취급한다.

## 반드시 기억할 핵심

같은 사건/사실이라도 인물마다 다음이 달라질 수 있어야 한다.

- 직접 알고 있음
- 일부만 알고 있음
- 다른 사람에게 전해 들음
- 소문으로 알고 있음
- 잘못 알고 있음 / 오해하고 있음
- 무엇인지 모르고 있음
- 과거에는 알았으나 현재 상황에서는 접근하지 못함

즉,

> `WORLD FACT ≠ NPC KNOWLEDGE`

이며, `informationAccess`만으로는 충분하지 않다.

`informationAccess`는 정보 접근 범위를 나타내는 기존 경계이고, 앞으로 필요한 것은 **개별 인물의 실제 지식 상태와 그 지식이 형성된 경로**다.

## 이 기반이 필요한 이유

### 1. 생동감

NPC마다 같은 사건을 서로 다른 관점과 정보량으로 받아들이게 해야 한다.

### 2. 비용 절약

LLM에게 세계 전체를 주고 "이 인물이 무엇을 아는지"를 매번 추론시키지 않는다.

엔진이 먼저 최소한의 NPC Knowledge State를 구성하고, LLM에는 현재 장면에 필요한 정보만 전달한다.

### 3. 정보 비대칭의 실제 구현

플레이어가 아는 사실, NPC가 아는 사실, NPC가 모르는 사실, NPC가 잘못 알고 있는 사실을 하나의 동일한 정보로 취급하지 않는다.

### 4. 이후 Index / Anchor / Retrieval의 기반

Anchor와 Relationship Web은 "무엇이 연결되어 있는가"를 다루고, Knowledge State는 "그 연결된 사실을 이 인물이 무엇으로 알고 있는가"를 다룬다.

### 5. LLM 역할 분리

엔진은 **누가 무엇을 알고 있는지**를 구조적으로 선별하고,
LLM은 그 지식 상태를 바탕으로 **어떻게 말하고 행동할지**를 서사적으로 표현한다.

---

# 다음 해야 할 것

## 1. 기존 코드에서 비대칭 정보의 현재 구현 범위를 전수 조사한다

EOF 기준으로 다음을 추적한다.

- `CanonicalState`
- `History`
- `informationAccess`
- NPC / Character 상태
- Relationship / 관계 정보
- Event / Action
- Rumor
- Identity / Passport
- Narrative Seed
- Offscreen Event / Wake
- Player Input provenance
- 현재 Index / Retriever
- KnowledgeGraph

목표는 **이미 존재하는 데이터만으로 어디까지 인물별 Knowledge State를 만들 수 있는지** 확정하는 것이다.

새 필드나 새 저장 구조부터 만들지 않는다.

## 2. NPC Knowledge State의 최소 의미 모델을 확정한다

최소한 다음 차이를 표현할 수 있어야 한다.

- KNOW / 확실히 알고 있음
- PARTIAL / 일부만 알고 있음
- HEARD / 전달받음
- RUMOR / 소문으로 앎
- MISBELIEF / 잘못 알고 있음
- UNKNOWN / 모름

단, 위 명칭은 구현 전 현재 코드와 기존 타입을 먼저 대조하여 최종 확정한다.

또한 **지식 자체와 지식의 진실성/권위는 분리**한다.

NPC가 잘못 알고 있다는 사실도 세계의 Canonical Truth를 오염시키지 않는다.

## 3. 정보가 인물에게 어떻게 도달하는지 추적 가능한 구조를 확립한다

핵심은 단순히

> `NPC B knows EVENT_183`

가 아니다.

가능하면 기존 History / Relationship / Event / Action 구조에서 다음 계보를 추적할 수 있어야 한다.

```text
WORLD FACT
    ↓
정보 발생/획득
    ↓
누가 접했는가
    ↓
어떤 경로로 전달되었는가
    ↓
NPC가 무엇을 알게 되었는가
```

정보의 이동도 세계의 인과관계 일부로 취급한다.

## 4. Knowledge State를 Retrieval / Branch Selection과 연결한다

Knowledge State가 만들어진 뒤에야 다음 구조를 본격적으로 연결한다.

```text
CANON / HISTORY
        ↓
WORLD INDEX
        ↓
RELATIONSHIP WEB
        ↓
ANCHOR
        ↓
BRANCH SELECTION
        ↓
NPC KNOWLEDGE STATE
        ↓
MINIMUM SUFFICIENT RETRIEVAL
        ↓
LLM
```

중요한 원칙:

- Anchor는 Retrieval Hook이지 Truth Authority가 아니다.
- Relationship Web은 연결을 제공하지만 전체를 무조건 전달하지 않는다.
- Branch Selection은 엔진이 담당한다.
- NPC Knowledge State는 Information Asymmetry를 결정한다.
- LLM은 임의의 세계 정보를 발굴해서 NPC의 지식을 만들지 않는다.

## 5. NPC별 최소 정보 패킷을 설계하고 비용 최적화를 검증한다

최종 목표는 매번 NPC에게 세계 전체를 보내는 것이 아니다.

```text
세계 전체 정보
      ↓
엔진 선별
      ↓
NPC가 실제로 알고 있는 정보
      ↓
현재 장면과 관련된 정보만 선택
      ↓
최소 충분 컨텍스트
      ↓
LLM
```

가능하면 정보 표현도 단계화한다.

```text
Reference → Summary → Detail
```

현재 판단에 Reference만 필요하면 상세 서사를 만들지 않는다.
상세 정보가 정말 필요할 때만 상위 해상도로 확장한다.

---

# 작업 순서에 대한 강제 메모

**지금은 Index / Anchor / 거미줄을 먼저 완성하는 단계가 아니다.**

먼저 **비대칭 정보 기반을 확립한다.**

그 후 그 기반 위에서 Index / Relationship Web / Anchor / Branch Selection / Minimum Retrieval을 연결한다.

### 한 줄 요약

> **"같은 세계를 모든 NPC가 똑같이 아는 엔진"에서 벗어나, "각 NPC가 자신의 경험·전달 경로·관계·현재 상황에 따라 서로 다른 세계를 알고 있는 엔진"을 만드는 것이 다음 기반 작업이다.**

이 원칙은 생동감과 비용 최적화를 동시에 위한 것이다.

# HUMAN NARRATIVE PRIOR — 연구 방향 및 향후 개발 구상

## 0. 문서의 지위

이 문서는 VEIL의 **Human Narrative** 연구축에 대한 방향성, 연구 가설, 데이터화 방법 및 향후 구현 순서를 정리한 아이디어 문서다.

이 문서는 현재 VEIL Engine의 핵심 Truth Authority를 변경하지 않는다.

특히 다음을 우선한다.

> **Canonical Truth > Causal Validity > Narrative Coherence > Creative Diversity**

Human Narrative Prior는 Canonical State, World Rules, Identity, Causal Authority, Validated State Transition, Sovereign Commit을 직접 결정할 수 없다.

현재 단계에서는 이 연구축을 본체 엔진과 분리하여 보존한다. VEIL 핵심 엔진과 World Simulation이 충분히 안정화되고 독립적으로 검증된 이후 본격적인 연구·구현에 착수한다.

---

## 1. 출발점 — AI 서사 클리셰 문제

VEIL의 Human Narrative 연구는 단순히 'AI 클리셰를 금지하자'는 발상에서 끝나지 않는다.

LLM은 동일하거나 유사한 세계관·캐릭터·장르 조건에서 높은 확률의 익숙한 서사 trajectory로 수렴할 수 있다.

대표적으로 다음과 같은 반복이 문제가 된다.

- 발견 → 추적 → 적대 → 보상
- 수상한 단서 → 조사 → 비밀 → 더 큰 비밀 → 음모
- 숨겨진 강자 / 비밀 조직 / 운명적 인연
- 위기 고조 → 주인공의 특별한 능력 → 해결
- 플레이어를 특별한 존재로 만들기 위한 편의적 사건

그러나 단순한 금지 목록이나 단어 필터만으로는 이 문제를 해결할 수 없다.

표현을 바꾸어도 같은 서사 기능과 의미를 유지할 수 있기 때문이다.

따라서 목표는 **AI 클리셰의 표면적 표현을 제거하는 것**이 아니라, LLM이 반복적으로 선택하는 서사적 선택공간 자체를 다루는 것이다.

---

## 2. 문제의 확장 — 무엇으로 대체할 것인가

AI의 반복 경로를 억제하기만 하면 문제가 생긴다.

무리하게 '새로운 것'만 요구할 경우:

- 현재 플레이어 행동과 무관한 사건이 삽입될 수 있고
- Canonical State에 근거하지 않은 사건을 만들어낼 수 있으며
- 인과성이 약한 억지스러운 전개가 발생할 수 있고
- 단순 무작위성이 독창성으로 오인될 수 있다.

따라서 다음 가설이 형성된다.

> **LLM이 가진 기본 Narrative Prior에만 의존하게 하지 않고, 인간 서사에서 장기간 반복적으로 살아남은 구조적·인과적·감정적 작동 원리를 추상화하여 별도의 Human Narrative Prior로 제공하면, 현재 세계에 맞는 새로운 서사 경로를 더 넓게 탐색할 수 있을 가능성이 있다.**

이 문장은 현재 HYPOTHESIS다.

실제 서사 품질 향상은 아직 검증되지 않았다.

---

## 3. 핵심 개념 — 인간 서사의 '미분'

Human Narrative Prior DB를 만들기 위해 인간 역사상 축적된 작품을 단순 줄거리 데이터로 저장하지 않는다.

각 작품을 하나의 완성된 이야기로 보는 대신, 서사를 변화의 연쇄로 분석한다.

기본 분석 단위는 다음과 같은 방향을 가진다.

```text
WORK
  ↓
SCENE / EVENT
  ↓
PRE-STATE
  ↓
EVENT
  ↓
POST-STATE
  ↓
ΔSTATE
  ↓
Δ²STATE
  ↓
ACCUMULATION
  ↓
TRAJECTORY
  ↓
STRUCTURE
  ↓
MECHANISM
  ↓
VARIATION / DETAIL
```

여기서 '미분'은 수학적 미분을 문자 그대로 수행한다는 뜻이 아니라, 완성된 작품에서 **무엇이 어떻게 변화했는지, 그 변화가 어떤 관계와 결과를 낳았는지를 단계적으로 분해한다는 개념적 비유**다.

목표는 '이 작품은 이런 이야기다'라는 요약이 아니라:

> **어떤 상태에서 어떤 사건이 발생했고, 어떤 상태 변화가 일어났으며, 그 변화가 이후의 선택공간과 인물·관계·감정·인과 trajectory를 어떻게 변화시켰는가?**

를 추출하는 것이다.

---

## 4. 작품은 데이터가 아니라 관찰 corpus다

Human Narrative Prior DB는 작품 줄거리 백과사전이 아니다.

개별 작품은 인간 서사에서 반복되거나 변형되는 구조를 발견하기 위한 **관찰 자료(corpus)**다.

따라서 장기적으로는 다음을 분리한다.

### 4.1 작품 특유 요소

- 특정 인물
- 특정 장소
- 특정 사건
- 특정 세계관 설정
- 특정 문장이나 대사
- 특정 작가의 문체

이는 원작 재현을 위한 데이터가 아니다.

### 4.2 장르 특유 요소

예:

- 미스터리에서 정보가 지연·재해석되는 방식
- 비극에서 선택과 결과가 누적되는 방식
- 희극에서 기대와 실제의 불일치가 반복되는 방식
- 로맨스에서 관계의 상태 변화가 진행되는 방식

장르 요소 역시 그대로 복제하는 것이 아니라 **작동 원리와 변주 가능성**을 연구한다.

### 4.3 장르를 넘어 반복되는 인간 서사 구조

서로 다른 시대·지역·장르에서도 반복적으로 발견되는 구조가 있는지 조사한다.

이 영역이 Human Narrative Prior의 핵심 후보가 된다.

---

## 5. 미분의 핵심 — STRUCTURE / MECHANISM / VARIATION

Human Narrative Prior는 최소한 세 층으로 분리한다.

### STRUCTURE

반복적으로 관찰되는 서사적 골격.

예:

> 한 선택이 단기적으로 원하는 결과를 제공하지만, 그 결과가 장기적으로 선택의 의미를 뒤집는 구조.

### MECHANISM

그 구조가 왜, 어떤 조건과 순서에서 작동하는지를 분석한다.

- 어떤 기대가 형성되는가
- 어떤 정보가 가려져 있는가
- 어떤 선택이 발생하는가
- 어떤 인과적 결과가 발생하는가
- 어떤 관계·가치·정체성이 변화하는가
- 왜 그 변화가 후속 서사를 발생시키는가

### VARIATION / DETAIL

동일한 구조와 메커니즘을 반복 복제하지 않고 새로운 상황에서 구현하기 위한 변주 공간이다.

- 인물
- 관계
- 욕망
- 정보 비대칭
- 장소
- 시간
- 행동
- 선택
- 타이밍
- 환경
- 결과
- 후속 의미

등의 조합이 달라질 수 있다.

핵심 원칙:

> **구조를 추출하되 구조를 공식으로 고정하지 않는다.**

> **디테일을 보존하되 원작의 디테일을 복제하지 않는다.**

---

## 6. '왜 반복되는가'까지 기록한다

단순 빈도는 Human Narrative Prior의 가치 판정 기준이 아니다.

가능한 경우 각 구조에 대해 다음을 기록한다.

- 반복 관찰 정도
- 기대 형성 기능
- 감정적 기능
- 인과적 기능
- 인지적 재해석 기능
- 인물 선택과의 관계
- 관계·가치·정체성 변화
- 후속 서사 선택공간에 미치는 영향
- 장르별 변형 방식
- 다른 작품에서의 독립적 재출현 여부

단, '왜 인간에게 효과적인가'에 대한 설명은 자동으로 사실이 아니다.

각 판단은:

- FACT
- INFERENCE
- HYPOTHESIS
- UNKNOWN

으로 구분한다.

작품에서 자주 등장한다는 사실과 인간에게 실제로 재미있다는 사실을 동일시하지 않는다.

---

## 7. 인간 클리셰와 AI 클리셰를 구분한다

인간 서사에서도 반복되는 구조가 존재한다.

그러나 반복 자체를 저품질로 취급하지 않는다.

오랜 기간 반복된 인간 서사 구조는 감정적·인지적·서사적 기능을 가졌을 가능성이 있다.

따라서 목표는:

> **인간 클리셰 제거**

가 아니다.

목표는:

> **인간 서사에서 반복적으로 관찰된 구조적 선택지를 추상화하여 새로운 상황에 적용할 수 있는 탐색 공간을 확보하는 것**

이다.

반대로 LLM이 높은 확률로 반복하는 AI 특유 trajectory는 별도의 억제 대상으로 취급할 수 있다.

---

## 8. '적분' — 새로운 서사 생성

미분 단계에서 축적한 Human Narrative Prior는 새로운 작품의 줄거리를 그대로 복원하기 위한 것이 아니다.

생성 단계에서는 다음을 결합하는 것을 목표로 한다.

```text
Human Narrative Prior
        +
Current Canonical State
        +
World Rules
        +
Identity / Relationship State
        +
History
        +
Player Intent
        +
Current Causal Space
        ↓
Narrative Search / Planning
        ↓
New Concrete Variation
        ↓
VEIL Validation / Triage
        ↓
Approved Narrative Reality
        ↓
LLM Expression
```

이 과정을 개념적으로 **'적분'**이라고 부른다.

즉 인간 서사의 미분 결과를 단순히 다시 합치는 것이 아니라, 현재 VEIL 세계의 고유한 상태와 결합하여 새로운 구체적 서사를 구성한다.

목표는:

> **인간 서사에서 검증된 구조적 원리 + 현재 세계의 고유한 상태 + 새로운 변주**

이다.

---

## 9. 적분은 작품 복제가 아니다

Human Narrative Prior가 다음과 같이 작동하면 실패다.

```text
원작 A
↓
원작 A와 유사한 사건
↓
인물명만 변경
↓
새 이야기라고 주장
```

또한:

```text
STRUCTURE A
↓
항상 같은 사건
↓
항상 같은 반전
↓
항상 같은 결말
```

역시 실패다.

Human Narrative Prior가 제공해야 하는 것은 특정 사건의 정답이 아니라 **새로운 구체적 구현을 탐색할 수 있는 구조적 선택공간**이다.

---

## 10. Human Prior 자체가 새로운 AI 클리셰가 되는 것을 방지한다

가장 중요한 연구 위험 중 하나다.

인간 작품을 많이 분석한 결과가:

> 욕망 → 갈등 → 위기 → 반전 → 대가

같은 고정 공식으로 압축되고, LLM이 모든 이야기를 그 공식대로 생성한다면 연구는 실패한다.

따라서 DB의 목적을 '자주 나온 순서의 복제'로 정의하지 않는다.

특히 다음을 구분해야 한다.

- 구조의 존재
- 구조가 작동하는 조건
- 구조의 기능
- 구조의 변형 가능성
- 구조가 실패하는 조건
- 서로 다른 구조가 같은 표면 결과를 만드는 경우
- 같은 구조가 전혀 다른 디테일로 구현되는 경우

Human Narrative Prior는 **공식집이 아니라 탐색 공간**이어야 한다.

---

## 11. VEIL과의 권한 분리

Human Narrative Prior가 생성에 참여하더라도 Truth Authority를 획득해서는 안 된다.

권한 구조는 다음을 유지한다.

```text
Human Narrative Prior
        ↓
Narrative Candidate / Planning
        ↓
VEIL World Rules
        ↓
Canonical State
        ↓
Identity
        ↓
Causal Validation
        ↓
PreAuth / Triage
        ↓
Sovereign Commit
        ↓
Canonical History
```

Human Prior는 '이런 서사적 방향을 탐색할 가치가 있는가'를 지원할 수 있지만,

> **'그러므로 이 사건은 세계의 사실이다'**

라고 판정할 수 없다.

이 원칙은 기존 VEIL Truth Authority 헌법과 독립적으로 충돌하지 않아야 한다.

---

## 12. DENY와 Human Narrative Prior

DENY된 후보를 Human Narrative Prior의 일반 서사 기억으로 승격하지 않는다.

특히:

1. Canonical State에 반영하지 않는다.
2. 일반 Narrative Memory에 넣지 않는다.
3. 다음 턴의 창작 context에 일반 기억으로 재주입하지 않는다.
4. 단순 표현 변경으로 동일한 비승인 상태변경을 재생성하도록 유도하지 않는다.
5. 내부 rejection record가 필요한 경우 forensic/audit 영역으로 분리한다.

단, 세계의 이후 상태가 변화하여 동일한 결과가 새로운 합법적 원인과 권한을 통해 가능해진 경우에는 **새로운 causal grounding**을 통해 별도로 판단한다.

즉 과거 DENY는 영구적인 세계 규칙이 아니며, 동시에 LLM이 단순 우회하여 같은 거부 경로를 반복하도록 허용하는 것도 아니다.

---

## 13. Narrative Diversity는 무작위성이 아니다

Human Narrative Prior의 목표를 무작위 사건 생성으로 정의하지 않는다.

```text
Random NPC
+ Random Location
+ Random Event
≠
Human Narrative Diversity
```

새로운 서사는 현재의:

- Canonical State
- World Rules
- Player Intent
- Identity
- Relationships
- History
- Causal possibilities

에서 출발해야 한다.

독창성 때문에 세계의 사실을 위조하거나 현재 플레이어 행동과 무관한 사건을 강제로 삽입해서는 안 된다.

---

## 14. DB의 장기적 목표 — 인류 서사의 압축된 탐색 공간

장기적으로는 인간 역사상 다양한 작품을 장르별·시대별·문화별로 분석하고, 개별 작품의 표현을 저장하는 대신 반복적으로 관찰되는 구조와 메커니즘 및 변주 공간을 압축한다.

개념적 흐름:

```text
인류의 작품 corpus
        ↓
작품별 forensic analysis
        ↓
SCENE / EVENT / STATE CHANGE
        ↓
패턴 추출
        ↓
STRUCTURE
        ↓
MECHANISM
        ↓
VARIATION / DETAIL
        ↓
작품 간 비교
        ↓
장르별 패턴
        ↓
장르 간 공통 패턴
        ↓
Human Narrative Prior DB
```

최종 목표는 '10,000편의 줄거리 DB'가 아니다.

> **가능한 한 적은 추상화 데이터로 가능한 한 넓은 인간 서사 탐색 공간을 표현하는 것**

이다.

---

## 15. 분석기의 다양성

GPT, Gemini, Qwen 등 여러 분석기를 사용할 수 있다.

분석기 간 해석 차이를 단순 오류로 제거하지 않는다.

구분 대상:

- 여러 분석기가 공통으로 발견한 구조
- 특정 분석기만 발견한 구조
- 동일 현상을 서로 다른 층에서 설명한 분석
- 추가 검증이 필요한 불확실한 분석

다중 분석기의 목적은 같은 답을 반복 생산하는 것이 아니라 **관찰 편향을 분산하고 인간 서사의 구조적 다양성을 더 넓게 탐색하는 것**이다.

---

## 16. 검증은 대규모 DB 구축보다 먼저 시작한다

처음부터 수천~수만 작품을 분석하는 것은 금지하지 않지만, 그것을 선행 조건으로 삼지 않는다.

먼저 작은 규모의 falsification experiment를 수행한다.

예시:

```text
동일 VEIL 세계
동일 Player Intent
동일 모델

A. 일반 Narrative Generation
B. AI Narrative Pattern 억제
C. Human Narrative Prior 적용
```

가능한 경우 평가한다.

- 인간 평가 서사 품질
- Structural Diversity
- AI cliché 발생률
- Narrative Coherence
- Character / Relationship Meaning
- Causal Consequence
- Surprise / Expectation Management
- World Consistency
- Canonical Integrity
- 비용
- 호출 횟수
- 지연시간

효과가 없다면 대규모 DB 구축을 중단하거나 방향을 수정할 수 있어야 한다.

효과가 확인되면 분석 corpus와 DB 규모를 단계적으로 확장한다.

```text
소규모 prototype
→ 100~300
→ 1,000
→ 필요성 입증 시 추가 확장
```

10,000이라는 숫자는 목표 성능이나 성공 조건이 아니라 **장기적인 규모 가설**일 뿐이다.

---

## 17. 현재 연구 상태

### FACT

- LLM의 반복적인 서사 trajectory와 AI 특유 클리셰는 VEIL의 Human Narrative 연구에서 실제로 해결하려는 문제다.
- 단어 blacklist만으로는 의미적으로 동일한 서사 반복을 완전히 다루기 어렵다.
- VEIL의 Canonical Truth와 Narrative Generation은 권한을 분리해야 한다.
- 인간 작품을 구조·상태 변화·메커니즘 단위로 분석하는 연구 방법론을 설계할 수 있다.
- 홍루몽과 같은 개별 작품의 forensic analysis는 이 방법론을 시험하는 corpus-level 연구의 시작점이 될 수 있다.

### INFERENCE

- 인간 서사의 구조적 prior를 별도로 제공하면 LLM의 기본 narrative search space를 변화시킬 가능성이 있다.
- 구조·메커니즘·변주를 분리하면 원작 복제와 단순 공식화를 어느 정도 피할 가능성이 있다.

### HYPOTHESIS

- Human Narrative Prior + 현재 VEIL 세계 상태가 기존 LLM narrative prior보다 더 다양한 동시에 더 인과적으로 타당한 서사 경로를 만들어낼 수 있다.
- 이 방식이 인간 평가에서 실제 서사 품질을 향상시킬 수 있다.

### UNKNOWN

- LLM이 Human Narrative Prior를 실제 생성 선택공간으로 얼마나 활용하는가.
- Human Prior가 pretrained AI prior보다 우세하게 작동할 수 있는가.
- 대규모 작품 미분이 실제로 유용한 압축 표현을 만들어내는가.
- 장르별 prior와 장르를 초월한 인간 서사 prior를 어떻게 구분할 것인가.
- Human Prior가 새로운 고정 공식/클리셰 생성기로 변질되지 않는가.
- 인간 평가에서 품질·다양성·예측성·일관성의 개선이 재현되는가.

---

## 18. 기존 Human Narrative Constitution과의 관계

현재 존재하는 `idea/HUMAN_NARRATIVE_QUALITY_CONSTITUTION.md`는 이 연구축의 상위 개발 헌법으로 유지한다.

그 헌법은 다음을 이미 규정한다.

- 인간 클리셰 자체를 제거하지 않는다.
- STRUCTURE / MECHANISM / VARIATION을 분리한다.
- 작품을 단순 줄거리 DB로 만들지 않는다.
- 반복 이유를 분석하되 FACT / INFERENCE / HYPOTHESIS / UNKNOWN을 구분한다.
- Human Narrative Prior는 Truth Authority가 아니다.
- 품질과 다양성을 동일시하지 않는다.
- DB는 압축을 목표로 한다.
- 다중 분석기의 차이를 보존한다.
- 비교 실험 없이 품질 향상을 사실로 선언하지 않는다.
- 저작권 및 데이터 취급 경계를 유지한다.

본 문서는 그 헌법을 대체하지 않는다.

본 문서는 **그 헌법에서 출발한 구체적인 연구 방향을 '인류 서사의 미분 → Human Narrative Prior DB → VEIL 세계와의 적분'이라는 하나의 연구 모델로 정리하는 후속 설계 문서**다.

---

## 19. 향후 본격 착수 시 헌법 개정/추가 필요

이 연구축을 실제 프로젝트에 편입하는 시점에는 현재 헌법을 그대로 구현 규칙으로 간주해서는 안 된다.

Human Narrative Prior의 실제 추출·저장·검색·주입·생성 파이프라인을 설계하기 전에 기존 헌법을 다시 대조하고 필요한 개정 및 추가 헌법을 별도로 확정해야 한다.

특히 다음 영역은 착수 전에 명문화할 필요가 있다.

### 19.1 Prior 추출 헌법

- 무엇을 인간 서사의 유효한 prior로 인정하는가
- 단순 빈도와 구조적 유효성을 어떻게 구분하는가
- 작품 특유 요소와 일반화 가능한 요소의 경계를 어떻게 정하는가
- 분석기의 해석을 어느 수준에서 canonicalize하는가

### 19.2 Prior 데이터 헌법

- STRUCTURE / MECHANISM / VARIATION의 정확한 스키마
- 출처와 provenance
- confidence / evidence level
- 중복 구조 통합 규칙
- 서로 다른 기능을 가진 유사 구조의 분리 규칙
- 장르/시대/문화별 메타데이터
- 원작 표현 보존 범위와 저작권 경계

### 19.3 Prior 검색/주입 헌법

- 현재 세계 상태와 어떤 prior를 연결할 것인가
- LLM에 어느 수준의 추상화를 제공할 것인가
- 여러 prior를 어떻게 결합하는가
- prior가 생성 결과를 과도하게 결정하지 않도록 하는 방법
- Human Prior가 새로운 고정 공식이 되는 것을 어떻게 탐지하는가

### 19.4 Narrative Governance 헌법

- Human Prior → Candidate → VEIL Validation의 경계
- AI cliché suppression과 Human Prior selection의 관계
- DENY semantic memory와 Human Prior의 분리
- Triage와 Output Gate의 역할
- Narrative Quality와 Canonical Truth의 충돌 처리

### 19.5 평가 헌법

- 품질 평가 기준
- 다양성 평가 기준
- 반복성/클리셰 측정법
- 인간 평가 프로토콜
- 동일 조건 비교 실험
- 실패 판정 기준
- 비용/지연시간과 품질 사이의 trade-off

즉 본격 착수 시에는:

> **기존 HUMAN NARRATIVE QUALITY CONSTITUTION의 개정 + Human Narrative Prior Extraction Constitution + Prior Data/Provenance Constitution + Narrative Injection/Governance Constitution + Evaluation Constitution**

등의 추가 문서가 필요할 가능성이 높다.

현재는 이 개정 작업을 선행하지 않는다. 실제 파이프라인이 확정되는 시점에 기존 VEIL 헌법과 충돌 여부를 먼저 감사한 후 확정한다.

---

## 20. 현재 프로젝트에서의 우선순위

Human Narrative 연구는 폐기하지 않는다.

다만 현재 VEIL의 우선순위보다 앞서지 않는다.

현재 우선순위:

```text
VEIL Language
→ Recovery
→ Candidate
→ Identity
→ MeaningTree
→ Proposal
→ PreAuth
→ Sovereign Commit
→ Canonical State
→ History
→ Continuity
→ World Simulation
→ 장기 persistence / performance 안정화
```

그 이후 Human Narrative Prior 연구를 재개한다.

이때 기존 홍루몽 분석 및 기타 Narrative DB 자료는 **선행 연구 자산**으로 보존하고, 처음부터 다시 시작하지 않는다.

---

## 21. 최종 연구 가설

Human Narrative 연구의 장기 가설은 다음과 같이 정의한다.

> **인류가 축적한 방대한 서사 작품을 변화·인과·구조·메커니즘·변주의 단위로 미분하여 압축된 Human Narrative Prior를 구축하고, 이를 현재 VEIL 세계의 Canonical State·World Rules·Identity·History·Player Intent와 결합하여 새로운 서사적 선택공간으로 적분한다면, LLM이 pretrained narrative prior에 의해 익숙한 AI 서사 경로로 수렴하는 것을 줄이면서도 세계의 인과성과 일관성을 유지한 새로운 서사를 생성할 수 있는가?**

이 문서가 현재 답해야 하는 것은 '된다'가 아니다.

정확한 연구 질문은:

> **'실제로 되는가?'를 나중에 반증 가능한 실험으로 검증할 수 있도록 설계를 보존하는 것**이다.

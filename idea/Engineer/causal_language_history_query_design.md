# Causal Language History Query / Triage Access Architecture

- Document ID: `IDEA-ENGINEER-CAUSAL-LANGUAGE-HISTORY-QUERY-DESIGN`
- Status: `DIRECTIONAL PROPOSAL — NOT FINAL`
- Date: `2026-09-15`
- Classification: Causal Language / Triage / History & Novel Information Boundary

> 이 문서는 확정된 구현 사양이 아니다.
> 현재 Causal Language와 Triage의 방향을 검토하면서 예상되는 구조를 기록한다.
> 실제 구현 전에는 런타임 비용, Tool Calling 지원, 정보 경계, 장기 플레이 영향 및 Red-Team 결과를 다시 검증한다.

## 1. 문제

LLM이 Candidate를 생성하기 위해 History 또는 Novel 기록을 참고할 필요가 있을 수 있다.

그러나 LLM이 임의의 자연어로 History를 검색하도록 허용하면 다음과 같은 문제가 생길 수 있다.

- `A에 대한 모든 정보를 줘` 같은 광범위한 요청
- 현재 서사와 무관한 과거 정보의 대량 주입
- Player/NPC의 정보 경계 우회
- 전체 History를 사실상 LLM의 무제한 기억으로 제공
- 불필요한 Context 증가에 따른 토큰 비용 및 서사 품질 저하

반대로 Triage가 `이 정보는 현재 서사에 필요하지 않다`를 자체적으로 강하게 판정하여 거부하면, Triage가 LLM의 인간적 서사 판단을 과도하게 제한할 위험이 있다.

따라서 **정보의 필요성 자체를 Triage가 임의로 결정하는 것**과 **정보 접근 권한/범위를 Triage가 통제하는 것**을 분리할 필요가 있다.

## 2. 예상 방향

History / Novel Index에 접근하는 공식 질의는 자연어가 아니라 **Causal Language 기반 구조화 Query**로 제한하는 방향을 검토한다.

```text
LLM
  |
  | Causal Language Query
  v
Triage / Query Validator
  |
  | permitted subset
  v
Canonical History Index / Novel Index
  |
  v
Context Packet
  |
  v
LLM continuation
```

핵심 예상 원칙:

> **LLM은 무엇을 알고 싶다고 요청할 수 있지만, History를 어떤 방식으로 검색할지는 자유롭게 정하지 못한다.**

## 3. 자연어 History 검색 API를 없애는 방향

가능하다면 History Index API 자체가 다음과 같은 자연어 검색을 받지 않도록 한다.

```text
History.search("A에 대한 모든 정보 줘")
```

대신 구조화된 Causal Language Query만 허용한다.

예상 형태:

```text
HistoryQuery {
    subject
    relation
    object?
    temporalConstraint?
    causalPurpose
    candidateId
}
```

예시:

```text
subject = A
relation = CAUSAL_PRECONDITION
object = EVENT_X
causalPurpose = EXPLAIN_CANDIDATE
candidateId = CANDIDATE_17
```

이 경우 자연어 문자열을 억지로 검증하는 것이 아니라 **검색 capability 자체가 Causal Language 계약을 요구**하게 된다.

## 4. 100년 전 정보 요청 문제

LLM이 다음과 같이 요청하는 상황을 고려한다.

> `A가 태어나기 100년 전의 사건이 필요하다.`

이를 단순히 오래된 정보라는 이유로 거부하지 않는다.

예를 들어 Candidate가 현재 사건의 원인을 과거 사건에 연결하고 있고, Causal Language Query가 그 관계를 표현한다면:

```text
subject = A / EVENT_X
relation = CAUSAL_PRECONDITION
period = BEFORE(A.birth, 100y)
purpose = EXPLAIN_CANDIDATE
```

처럼 표현할 수 있다.

Triage는 `100년 전이라서 필요 없다`를 판정하는 것이 아니라:

1. Query 구조가 유효한가?
2. 대상/관계/시간 조건이 해석 가능한가?
3. 해당 Index 영역에 접근할 권한이 있는가?
4. Information Boundary를 침범하는가?
5. 요청 가능한 범위/크기인가?

를 검사한다.

따라서 실제 서사상 필요한 과거 정보는 허용될 수 있어야 한다.

## 5. Triage의 역할 경계

Triage가 담당할 것으로 예상하는 것:

- Query 구조 검증
- Causal Language 문법/의미 계약 검증
- Entity/Relation/Time reference 검증
- Information Boundary 적용
- Canonical / Novel / Unknown / Unproven 상태에 따른 접근 범위 결정
- 검색 범위 및 결과 크기 제한
- Provenance를 유지한 Context Packet 생성

Triage가 담당하지 않아야 하는 것:

- `이 정보는 서사적으로 쓸모없다`라는 최종 판단
- 인간적 서사의 의미 자체를 임의로 삭제
- LLM의 Candidate 의미를 Canonical Truth로 확정
- Causal Witness 자체 발급

최종 Canonical mutation authority는 기존 Sovereign Engine에 남긴다.

## 6. Query 실패와 Candidate 실패의 분리

History Query가 잘못되었다고 해서 반드시 Candidate 전체를 즉시 Reject하는 구조는 피하는 방향을 검토한다.

```text
Invalid Query
    |
    +--> Query repair / clarification / narrower query
    |
    +--> Candidate remains alive when its underlying proposal is still valid
```

목표는 Query 형식 오류가 누적되어 정상적인 서사까지 `REJECT`되는 것을 방지하는 것이다.

## 7. LLM 호출 비용에 대한 예상 구조

별도 `LLM Query 생성 호출 -> History 검색 -> 별도 LLM Candidate 생성 호출`을 강제하지 않는다.

가능하다면 Tool Calling / structured generation 형태로:

```text
LLM inference
    |
    +--> Candidate proposal
    |
    +--> Causal History Query tool call
              |
              v
         Triage / Index
              |
              v
         Tool result
              |
              v
       LLM continuation
```

형태를 검토한다.

단, 실제 API 비용은 tool-call 이후의 추가 inference round와 input/output token을 기준으로 측정해야 하며, `API 호출 1회`와 `LLM inference 1회`를 동일한 개념으로 취급하지 않는다.

## 8. 최종 예상 방향

```text
PLAYER INPUT
    |
    v
PRE-TRIAGE / CONTEXT PREPARATION
    |
    +--------------------------+
    |                          |
    v                          v
LLM Candidate             Causal Query
                               |
                               v
                        Query Triage
                               |
                    +----------+----------+
                    |                     |
                 ALLOW                  DENY/REPAIR
                    |                     |
                    v                     |
             History / Novel Index       |
                    |                     |
                    +----------+----------+
                               |
                               v
                         Context Packet
                               |
                               v
                         LLM continuation
                               |
                               v
                       Candidate / Semantic IR
                               |
                               v
                       POST-TRIAGE / Causal
                               |
                               v
                         Sovereign Engine
                               |
                               v
                       Canonical Commit
```

## 9. 설계 상태

현재 결론은 다음 수준으로만 기록한다.

- **FACT:** 현재 Causal Language 문서는 History/Novel, Causal Authority, Anchor, MeaningTree/Engine Language 연계를 이미 설계 대상으로 포함하고 있다.
- **PROPOSAL:** History/Novel 열람을 Causal Language Query 전용 capability로 제한하는 방향.
- **PROPOSAL:** Triage는 정보의 최종 서사적 필요성을 판단하기보다 접근 권한/범위/구조를 검증하는 경계 계층으로 둔다.
- **PROPOSAL:** Query 실패와 Candidate 실패를 분리한다.
- **PROPOSAL:** 가능하다면 Tool Calling을 통해 Query → Index → Context → LLM continuation을 하나의 agentic generation cycle 안에서 처리한다.
- **UNKNOWN:** 실제 모델별 Tool Calling 비용, 추가 inference round, Query 품질, 장기 서사 품질 개선 효과.
- **NOT IMPLEMENTATION CONTRACT:** 이 문서는 구현 완료 또는 최종 헌법 선언이 아니다.

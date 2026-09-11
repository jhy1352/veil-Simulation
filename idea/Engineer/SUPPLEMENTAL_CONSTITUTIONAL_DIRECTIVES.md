# TRPG 3.1 — Supplemental Constitutional Directives

## 문서의 지위

이 문서는 `idea/Engineer/`에 존재하는 설계 문서들 가운데, 현재 `server.ts`의 헌법 조항에 아직 명시적으로 편입되지 않았거나 충분히 구체화되지 않은 **헌법급 설계 원칙**을 하나의 관리 지점으로 모아두기 위한 보조 헌법 기록이다.

- 이 문서 자체는 런타임 권위가 아니다.
- `UNIFIED_SOVEREIGNTY_CONSTITUTION.md`와 현재 런타임 코드의 중복을 의도적으로 최소화한다.
- 이후 실제 책임 모듈이 확정되면 이 원칙들은 해당 실행 계층으로 분배한다.
- 새로운 원칙이 개발 중 헌법급으로 승격되면 우선 이 파일에 추가하고, 이후 실제 코드 책임 위치를 결정한다.
- 기존 헌법과 충돌하는 경우 이 문서가 우선하지 않는다. 충돌은 보고하고 해결 절차를 거친다.

---

# I. Open Input / Closed Commit

### 제S-1조. 입력 개방성과 Commit 폐쇄성

1. 플레이어의 자연어 입력은 가능한 한 자유롭게 받아들인다.
2. 플레이어가 어떤 방식으로 의도와 행동을 표현했는지는 세계의 사실 확정 권한과 분리한다.
3. `Player Input`은 세계 사실이나 Candidate 그 자체가 아니다.
4. 플레이어 입력은 의도 해석과 Narrative 창작의 원재료가 될 수 있다.
5. 세계의 사실을 변경하는 것은 반드시 기존의 검증·Proposal·Commit 경계를 통과해야 한다.
6. 따라서 다음 원칙을 유지한다.

```text
Player Freedom = Open
World Truth Commit = Closed
```

7. 자연어의 자유를 제한하여 엔진을 안전하게 만드는 것이 아니라, 자유로운 입력과 닫힌 Commit 경계를 동시에 유지하여 Player Agency와 World Integrity를 함께 보존한다.

---

# II. Player Input Provenance

### 제S-2조. 원본 입력과 LLM 해석의 분리

1. 실제 Player Input은 원본 의도·행동의 근거로 보존한다.
2. LLM이 Player Input을 해석하여 만든 Candidate는 LLM이 생성한 제안이다.
3. Candidate의 `source`와 Player Input의 원본 기원은 동일한 개념이 아니다.
4. Player Input을 Candidate로 승격하여 별도의 세계 사실이나 권위 계층으로 취급하지 않는다.
5. 필요한 경우 기존 `originInputId` 등의 기존 provenance 연결을 사용하여 Candidate/Proposal/History가 실제 원본 입력으로 거슬러 올라갈 수 있게 한다.
6. 서버가 생성한 입력 식별자를 권위 있는 원본 연결점으로 사용하며, 클라이언트가 임의로 공급한 식별자를 신뢰하지 않는다.
7. 원본 Player Input의 보존은 세계 사실의 권위 부여가 아니다.

---

# III. Candidate Recovery Boundary

### 제S-3조. Recovery는 의미 복구이지 Truth Authority가 아니다

1. malformed 또는 부분적으로 손상된 LLM 출력을 복구하는 Recovery 계층은 기존 구조화된 검증 경계를 보조한다.
2. Recovery는 새로운 세계 사실을 발명하거나 기존 Canonical State를 우회하여 승인할 권한을 갖지 않는다.
3. Recovery가 후보를 복구하더라도 최종 판단은 기존 PreAuth / Validator / Sovereign Commit 경로를 따른다.
4. 복구에 실패한 Candidate는 해당 Candidate만 제거할 수 있으며, 실패한 후보를 다른 단계에서 부활시키지 않는다.
5. Recovery가 자연어 전체의 '완벽한 의미 판정기'가 되는 구조를 만들지 않는다.
6. Player Input과 이미 검증된 후보 사이의 의미적 충실도 판단이 필요한 경우 기존 Narrative Reasoning 계층의 범위에서 수행하고 새로운 별도 LLM 권위를 추가하지 않는다.
7. `PreAuth ALLOW`, `Validator PASS`, `Canonical Commit`은 서로 다른 권한 단계로 계속 분리한다.

---

# IV. Identity Continuity

### 제S-4조. 정체성은 서사적 위상보다 오래 지속된다

1. Entity의 identity는 그 entity의 현재 서사적 중요도와 독립적으로 유지된다.
2. 인물이 주연에서 조연이 되거나, 감초적 존재에서 동료·적대자·핵심 인물로 변하는 것은 identity 변경이 아니다.
3. 역사적 위상이 낮아졌다는 이유로 identity, lineage 또는 과거의 Historical Record를 삭제하지 않는다.
4. identity resolution은 현재의 이름·상태만이 아니라 역사적 연속성, 관계, 사건 참여, 기존 식별 정보 및 authoritative history를 함께 고려한다.
5. 동일 인물의 상태 변화와 다른 인물의 생성은 구분한다.
6. 불확실한 identity는 가능한 경우 `AMBIGUOUS` 또는 resolution 대상 상태로 유지하며 근거 없이 새로운 identity를 생성하지 않는다.

---

# V. Passport Continuity

### 제S-5조. Passport는 권위가 아니라 연속성 Projection이다

1. Passport는 Canonical State와 Historical Record를 이용해 entity의 지속성을 빠르게 표현하는 derived projection/index다.
2. Passport 자체가 새로운 세계 사실을 생성하거나 Canonical State를 덮어쓰지 않는다.
3. Genesis 이후 Passport를 생성할 수 있으며, 승인된 State Transition 이후 authoritative history를 기준으로 재투영한다.
4. Session Load에서도 검증된 Canonical State/History를 기준으로 Passport를 재투영한다.
5. 거부된 turn은 세계가 변경되지 않았으므로 Passport도 허위 변화로 갱신하지 않는다.
6. Passport와 Identity Resolver는 서로 다른 책임을 가진다.
   - Identity Resolver: 누가 누구인가를 판정한다.
   - Passport Projection: 현재까지 확인된 연속성을 표현한다.
7. Passport 불일치가 발견되면 Passport를 진실에 맞추며, Passport를 이용해 Canonical Truth를 역으로 변경하지 않는다.

---

# VI. Novel History Continuity

### 제S-6조. Novelty는 Forgery가 아니다

1. 새롭게 창작된 서사 요소가 존재한다는 사실만으로 그것을 위조나 오류로 취급하지 않는다.
2. `NOVEL`은 기존 Canonical History에 존재하지 않았던 새로운 서사적 요소를 의미할 수 있으며, 그 자체가 허위라는 뜻이 아니다.
3. Novel entity/event가 이후 authoritative history와 연결되거나 승격되는 경우 기존 lineage를 보존한다.
4. Canon ↔ Novel lifecycle의 승격·강등은 identity/history의 무조건적 삭제가 아니라 상태 및 권위 관계의 변화로 취급한다.
5. Demotion 이후에도 필요한 lineage와 역사적 흔적은 보존한다.
6. Novelty 판단과 Forgery/Contradiction 판단은 서로 다른 문제다.

---

# VII. Inventory Identity & Causality

### 제S-7조. 아이템도 역사적 정체성을 가진다

1. Inventory의 item은 단순 문자열 수량이 아니라 가능한 경우 canonical identity와 획득·이동 이력을 가진다.
2. 아이템의 소유자는 현재 Canonical State와 authoritative history를 통해 연결되어야 한다.
3. 아이템 획득은 가능한 경우 실제 원인(구매, 교환, 보상, 발견, 양도 등)과 연결된다.
4. 수량 변경은 비용·획득·소모·분실 등의 인과와 일관되어야 한다.
5. 동일한 item identity를 근거 없이 복제하여 세계의 자원을 증식시키지 않는다.
6. Inventory identity continuity는 Character identity continuity와 연결되지만 동일한 계층은 아니다.
7. Save/Load 이후에도 item identity와 ownership continuity가 보존되어야 한다.

---

# VIII. Dynamic Narrative Role

### 제S-8조. 서사적 위상은 시간적·관계적 상태다

1. `MAIN`, `SUPPORTING`, `COMIC_RELIEF`, `COMPANION`, `ENEMY` 등의 서사적 위상은 immutable identity attribute가 아니다.
2. 현재 서사적 위상은 Canonical History, 현재 상태, 인과적 중요도, 관계의 지속성, Player relevance, unresolved dependency 및 지역·세력·사건 연결성을 통해 도출한다.
3. 단순 등장 횟수, 공동 출현 횟수, 유명세만으로 narrative rank를 결정하지 않는다.
4. 과거의 조연이 장기적인 관계를 통해 핵심 Anchor가 될 수 있다.
5. 과거의 핵심 인물이 현재에는 더 이상 주요 Anchor가 아닐 수도 있다.
6. 위상이 내려가도 identity와 역사적 중요성은 삭제되지 않는다.
7. 따라서 인물의 현재 위상은 다음과 같이 이해한다.

```text
Identity
  ↓
Canonical History + Current Context
  ↓
Causal / Relationship Evidence
  ↓
Current Narrative Role / Anchor Status
```

8. 캐릭터는 미리 정해진 주연·조연 명단이 아니라 세계의 역사와 관계 속에서 위상이 변화하는 존재다.

---

# IX. Anchor Continuity

### 제S-9조. Anchor는 고정된 캐릭터 등급이 아니다

1. Anchor는 미래의 상태 변화나 서사 판단에 지속적으로 의미를 가질 수 있는 연결점이다.
2. Anchor가 될 수 있는 대상에는 NPC, faction, item, event, rumor, promise, relationship, location, narrative seed 등이 포함될 수 있다.
3. Anchor 여부는 단순 등장 횟수가 아니라 지속적인 causal/relational dependency를 중심으로 판단한다.
4. 현재 Anchor가 아니더라도 이후 사건으로 다시 중요한 Anchor가 될 수 있다.
5. Anchor가 사라지거나 relevance가 낮아졌다고 Historical Record를 삭제하지 않는다.
6. Anchor는 Wake Scope를 구성하는 근거가 될 수 있지만, Anchor 자체가 Canonical Authority는 아니다.

---

# X. Canon History as Wake Scope

### 제S-10조. 역사 검색은 오프스크린 Wake의 최소 충분 범위가 된다

1. 현재 관찰·질문·재진입·서사 의존성이 발생하면 관련 Canonical History를 먼저 검색한다.
2. 검색은 현재 상태와 연결된 entity/event/region/seed/faction/relationship의 authoritative history를 통해 최소 충분한 범위를 구성한다.
3. 필요한 경우 역사적 관계를 따라 Scope를 확장한다.
4. 목표는 전체 세계를 재생성하는 것이 아니라 현재 상태를 설명하는 데 필요한 최소 충분한 causal context를 확보하는 것이다.
5. 검색 결과가 없다는 사실은 사건이 존재하지 않았다는 증거가 아니다.
6. 이미 authoritative history에 존재하는 결과를 LLM으로 재생성하지 않는다.

---

# XI. Deferred Off-Screen Materialization

### 제S-11조. 시간의 경과와 세계의 물질화는 분리한다

1. 시간이 흘렀다는 사실만으로 LLM 호출을 발생시키지 않는다.
2. 지도 발견 자체가 역사 materialization을 의미하지 않는다.
3. 기존 Canonical State/History/WorldPack과 known information으로 현재 판단이 충분하면 Wake를 생성하지 않는다.
4. Wake가 필요할 때만 `Wake Necessity Gate`를 통과시키고 관련 scope를 집계한다.
5. map tile, NPC, item, 개별 Anchor마다 1:1 LLM 호출을 발생시키는 구조를 기본 모델로 삼지 않는다.
6. 서로 인과적으로 연결된 사건과 entity는 하나의 bounded causal cluster 또는 region scope로 집계할 수 있다.
7. Wake가 발생하면 우선 Causal Skeleton을 만들고, 필요할 때 Regional History, 이후 직접 상호작용에서 상세 Narrative를 물질화한다.
8. 이미 commit된 낮은 해상도의 역사 기록을 더 높은 서사 해상도로 다시 생성하여 덮어쓰지 않는다.
9. deferred world는 존재하지 않는 세계가 아니라 아직 상세화되지 않은 역사적 상태다.
10. 이후 materialization은 마지막 authoritative state, immutable history, elapsed time, identity continuity, information boundary 및 World Rules를 모두 존중한다.

---

# XII. Wake Aggregation & Causal Cluster

### 제S-12조. Wake는 독립 사건의 무차별 묶음이 아니다

1. Wake aggregation은 관련 사건을 묶되, 의미적으로 무관한 대상을 임의로 하나의 causal cluster로 합치지 않는다.
2. 단순히 같은 event payload에 ID가 많이 등장한다는 이유만으로 강한 인과 관계를 확정하지 않는다.
3. 가능한 경우 관계·시간·지역·사건 구조 등 authoritative evidence를 이용하여 cluster를 확장한다.
4. aggregation의 목적은 LLM 호출을 줄이는 것 자체가 아니라, 하나의 세계적 변화가 여러 연결된 결과를 설명할 수 있도록 충분하면서도 제한된 context를 만드는 것이다.
5. aggregation 결과도 Candidate Context일 뿐이며 Canonical Truth가 아니다.

---

# XIII. Knowledge Graph Boundary

### 제S-13조. Knowledge Graph는 파생 검색 구조다

1. Knowledge Graph는 Canonical State와 History에서 파생되는 retrieval/index 구조다.
2. Graph 자체는 Canonical Authority가 아니다.
3. graph에 존재하는 entity/relation은 원본 authoritative record와 구분한다.
4. semantic relation이 충분히 확립되지 않은 상태에서 단순 co-occurrence를 강한 의미 관계로 오인하지 않는다.
5. 향후 graph relation이 확장되더라도 `main character`, `supporting character`, `comic relief` 같은 narrative rank를 immutable entity type으로 고정하지 않는다.
6. narrative role은 graph/history/context evidence에서 도출되는 현재 상태로 취급한다.

---

# XIV. Information Asymmetry Continuity

### 제S-14조. 세계의 진실과 인물의 지식은 별개다

1. World Truth, Player Knowledge, Protagonist Knowledge, NPC Knowledge, Faction Knowledge, Rumor, Belief, Unknown을 혼동하지 않는다.
2. LLM이 context에서 어떤 정보를 볼 수 있다는 사실은 캐릭터가 그 정보를 알고 있다는 뜻이 아니다.
3. 정보는 가능한 경우 관찰·조사·증언·기록·전달·관계·능력 등의 실제 acquisition path를 가진다.
4. off-screen event가 발생했다고 해서 Player에게 자동 공개하지 않는다.
5. Player가 모른다고 해서 world event 자체를 존재하지 않는 것으로 처리하지 않는다.
6. information retrieval 역시 현재 주체가 접근 가능한 정보 경계를 존중한다.

---

# XV. Save / Load Continuity

### 제S-15조. 복원은 세계를 재창작하는 행위가 아니다

1. Save data는 외부 저장 표현이며 자동으로 Canonical Truth가 아니다.
2. Load된 상태는 schema/version/integrity/temporal/provenance/consistency 검증 후 authoritative runtime state로 사용한다.
3. 복원 과정에서 누락된 정보를 LLM이 임의로 발명하지 않는다.
4. Summary가 원본 Historical Record보다 높은 권위를 갖지 않는다.
5. Load 이후 identity, passport, inventory, relationship, narrative thread 및 information boundary는 authoritative state/history에서 재구성한다.
6. 오래된 snapshot이 최신 state를 조용히 덮어쓰지 않도록 한다.
7. Load는 새로운 세계 사건을 자동 발생시키는 과정이 아니다.

---

# XVI. Minimum Sufficient Retrieval

### 제S-16조. 검색은 전체 기억 투입이 아니라 판단에 필요한 기억 회수다

1. LLM context에 전체 history를 무차별적으로 투입하는 것을 목표로 하지 않는다.
2. 현재 요청과 직접 관련된 최소 충분한 history/state를 검색한다.
3. 검색 차원은 가능한 범위에서 시간, entity, event, region, faction, relationship, information status, causal dependency, narrative seed, current/previous state를 포함한다.
4. 최근 메시지 window와 장기 Historical Memory는 서로 다른 역할을 가진다.
5. token diet는 context 크기를 줄이는 기술이지 Historical Truth를 삭제하는 권한이 아니다.
6. 검색 실패와 기록 부재를 동일시하지 않는다.

---

# XVII. Constitutional Maintenance Protocol

### 제S-17조. 이 문서의 운영 규칙

1. 앞으로 개발 중 새롭게 발견된 원칙이 다음 조건을 만족하면 이 문서에 우선 기록한다.
   - 단순 구현 방법이 아니라 여러 모듈에 걸쳐 적용되는 원칙일 것.
   - 위반 시 세계 무결성·서사 철학·연속성·권한 구조가 훼손될 것.
   - 특정 함수 하나의 구현 세부사항이 아니라 장기적으로 유지해야 할 설계 계약일 것.
2. 단순 버그 수정법, 임시 workaround, 특정 테스트 fixture, 특정 API 사용법은 이 문서에 올리지 않는다.
3. 새로운 조항은 가능한 경우 다음 메타정보를 함께 기록한다.
   - 제안일
   - 발견 근거
   - 관련 설계 문서
   - 현재 runtime 영향 여부
   - 향후 분배 대상 모듈
4. 이미 상위 헌법에 존재하는 원칙을 단순 반복하여 중복 조항을 만들지 않는다.
5. 상위 헌법과 충돌하는 내용이 발견되면 이 문서를 임의로 수정하여 충돌을 숨기지 않는다.
6. 이 파일은 향후 `server.ts`가 비대해지지 않도록 **헌법급 원칙의 임시 중앙 registry** 역할을 한다.

---

# Constitutional Promotion Test

새 원칙을 이 문서에 추가할지 판단할 때 다음 질문을 사용한다.

```text
이것은 단순히 "어떻게 구현할까"인가?
        ↓ NO
여러 런타임 영역에서 반복적으로 지켜야 하는가?
        ↓ YES
위반하면 세계의 진실/연속성/Player Agency/Narrative Integrity가 깨지는가?
        ↓ YES
구현 세부사항이 바뀌어도 계속 유지되어야 하는가?
        ↓ YES
→ 헌법급 원칙 후보
```

반대로 특정 함수, 특정 라이브러리, 특정 API, 특정 테스트 케이스에만 해당하면 일반 설계/구현 문서로 남긴다.

---

## Source Registry

현재 이 문서에 통합한 주요 설계 근거:

- `idea/Engineer/UNIFIED_SOVEREIGNTY_CONSTITUTION.md`
- `idea/Engineer/sovereign_engine_constitution.md`
- `idea/Engineer/llm_engine_interaction_protocol.md`
- `idea/Engineer/temporal_long_term_memory_and_dynamic_world_state.md`
- `idea/Engineer/current_scope_and_dream_goals.md`
- `idea/Engineer/AUDITOR_TRUST_PROTOCOL.md`
- `idea/Engineer/forensic_audit_protocol.md`

### 현재 런타임 편입 상태

이 파일의 원칙들은 **모두 현재 런타임에 구현되었다는 뜻이 아니다.**
각 조항은 향후 실제 코드 위치를 결정할 때 다음 상태 중 하나로 관리한다.

- `RUNTIME-EMBEDDED`
- `RUNTIME-PARTIAL`
- `DESIGN-ONLY`
- `PENDING-IMPLEMENTATION`
- `SUPERSEDED`

현재 이 파일의 목적은 구현 완료를 선언하는 것이 아니라, 헌법급 설계 의도를 잃어버리지 않는 것이다.

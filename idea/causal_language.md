# Causal Language: Engine Language Causal Semantics Extension & Authority Architecture

- Document ID: `IDEA-CAUSAL-LANGUAGE`
- Status: `DESIGN_PROPOSAL`
- Date: `2026-09-07`
- Topic: `Engine Language 3.x Causal Semantics Extension, Temporal Order Separation, and Causal Authority Jurisdiction`

---

## 1. Executive Vision & Core Philosophy

TRPG 3.1 Narrative Engine은 사실(Fact), 정체성(Identity), 역사(History)를 엄격히 보존해왔다.
그러나 R1-U 포렌식 분석에서 밝혀졌듯:
> **"과거에 Canonical로 승인되었다는 역사적 사실(Historical Truth)"**과
> **"그 사건이 현재 특정 세계 상태 변화를 정당화할 인과적 권한을 갖는가(Current Causal Authority)"**

는 서로 다른 독립적 차원이다.

단순히 수십 개의 인과 관계 사전을 새로 만드는 대신, **기존의 11개 Engine Language Core Atoms(`ENTITY`, `ACTION`, `STATE`, `RELATION`, `CLAIM`, `TIME`, `CAUSE`, `ROLE`, `INTENT`, `VALUE`, `CONSTRAINT`) 위에 인과적 의미론(Causal Semantics)과 순서(Order) 체계를 확장**하여 언어 자체가 인과 검토의 공통 구조가 되도록 설계한다.

---

## 2. 서순(Order)의 다층적 분리 원칙

Engine Language에서 과거 겪었던 서순 문제를 반복하지 않기 위해, 다음 3가지 순서 체계를 엄격히 분리한다.

```text
1. Composition Order (언어 구조 순서)
   - ORDERED: 선언 순서 보존 (실행 순서의 기반)
   - UNORDERED: 선언 순서 무관 (Canonical Comparator로 정렬)

2. Temporal Order (세계 시간 순서)
   - BEFORE, AFTER, SAME_TIME, OVERLAPS, UNKNOWN
   - 단순 시간적 선후 관계 (A happens-before B ≠ A causes B)

3. Causal Dependency Order (인과 의존 순서)
   - CAUSES: 직접적 인과 발생
   - ENABLES: 선행 필요 조건 제공
   - INVALIDATES: 기존 인과 관계의 무효화/종결
```

> **헌법적 불변식**:
> - `ORDERED` 배열 순서를 곧바로 `CAUSAL` 관계로 승격시키지 않는다.
> - `UNORDERED`를 "동시 발생" 또는 "인과적 독립"으로 해석하지 않는다.
> - 시간적 선후(Temporal BEFORE)가 인과적 의존(Causal ENABLES/CAUSES)을 자동으로 보장하지 않는다.

---

## 3. Causal Jurisdiction Matrix (인과 관할권 분리)

엔진이 모든 서사에 개입하여 작가의 역할을 침해(월권)하지 않도록 관할권을 3단계로 분리한다.

```text
 ┌───────────────────┬───────────────────────────────┬──────────────────────────────────────────┐
 │ 관계 유형          │ 담당 계층                     │ 판결 및 실패 시 처리                      │
 ├───────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
 │ Canon → Canon     │ Sovereign Causal Engine       │ ALLOW / DENY (세계 상태 변경 직접 통제)   │
 │ Novel → Canon     │ Sovereign Causal Engine       │ ALLOW / DENY (Causal Witness 발급 여부)  │
 │ Novel → Novel     │ Recovery Gate (Causal Check)  │ CONSISTENT / RECONCILIATION_REQUIRED     │
 └───────────────────┴───────────────────────────────┴──────────────────────────────────────────┘
```

### 3.1 Canon → Canon & Novel → Canon
- 실제 `CanonicalState`의 변형(Mutation)을 수반하므로 엔진이 최종 인과 권한(Causal Authority)을 심사한다.
- 검증 통과 시 엔진이 **`Causal Witness`**를 발급하여 해당 변경을 커밋한다.
- 불일치 시 `DENY`하며 세계 상태는 변경되지 않는다.
- Novel 기록이 원인 후보로 사용되는 경우, 해당 인과 검증을 통과한 핵심 사실/관계만 필요한 범위에서 Canonical Authority를 획득한다(노벨 전체의 무분별한 승격 방지).

### 3.2 Novel → Novel (서사적 인과 영역)
- 엔진이 서사의 의미를 직접 재단하거나 `DENY`하지 않는다.
- Recovery Gate가 인과성 검토를 수행하여 불일치/환각 발생 시 **`RECONCILIATION_REQUIRED`**를 반환한다.
- 기존 기록을 무단 삭제하거나 지우는 조잡한 리트콘(Retcon)을 배제하고, LLM에게 **"기존 기록을 보존하면서 서사적으로 수습(Narrative Reconciliation)"**하도록 요구한다.

---

## 4. Narrative Anchor & Attention Set Architecture

Novel 영역의 미확정 인과관계가 환각이나 오염으로 이어지지 않도록 **Narrative Anchor** 시스템을 구축한다.

### 4.1 Anchor Epistemic States
1. `UNPROVEN`: 중요한 인과관계/약속이 아직 세계 증거로 확정되지 않음.
2. `CONTRADICTED`: 기존 정사/기록과 충돌하는 서사적 주장.
3. `DEPENDENCY`: 특정 조건(예: NPC 생존, 장소 유지)에 의존하는 관계.
4. `RECONCILIATION_REQUIRED`: 수습이 필요한 서사적 불일치.
5. `RESOLVED`: 정당한 증거나 후속 서사로 인과가 확정/해소됨.

### 4.2 2단계 Anchor 필터링 (토큰 비용 및 지연시간 보호)
LLM이 모든 Anchor를 매 턴 신경 쓰느라 서사 품질이 저하되거나 응답 시간이 지연되는 것을 방지하기 위해 **Engine-side Relevance Filter**를 적용한다.

```text
[전체 Anchor 저장소]
        ↓
[Engine-side 관련성 필터] (현재 장소, 등장 NPC, 관련 아이템 대조)
        ↓
[0 ~ 2개의 콤팩트한 Narrative Hint] (관련 없는 턴에는 0개 주입)
        ↓
[LLM 서사 생성] (안전 난간으로만 참고)
```

- Anchor는 **"강제할 일 목록"이 아니라 "서사적 안전 난간(Safety Rail)"**이다.
- LLM에게 억지로 해결을 강요하지 않고, 미확정 사실을 기정사실화하는 실수만 방지한다.

---

## 5. Causal Witness Schema & Engine Authority

LLM이 스스로 `causalType: GIFT_REWARD` 같은 문자열을 선언하여 권한을 자체 발급하는 자가 증명(Self-Minting)은 엄격히 금지된다.

```text
CausalWitness {
    witnessId: string;
    causeRecordId: string;
    effectType: string;
    subjectId: string;
    targetId?: string;
    relation: CausalRelation (CAUSES | ENABLES | INVALIDATES);
    temporalConstraint: TemporalRelation (BEFORE | SAME_TIME | ...);
    issuedAtStateVersion: number;
    authority: "ENGINE";
    status: "ACTIVE" | "CONSUMED" | "INVALIDATED" | "SUPERSEDED";
}
```

- **Scope-Bound Capability**: 발급된 Witness는 지정된 원인과 결과의 범위 내에서만 효력을 가지며, 다른 임의의 Mutation으로 전용될 수 없다.
- **Dependency Invalidation**: 시간 경과 자체로 만료되지 않으며, 실제 의존 조건이 파기되거나 명시적 무효화 사건이 발생했을 때만 권한을 상실한다.

---

## 6. 결론 및 향후 구현 단계

1. **Causal Constitution 확정**: 인과 권한 및 관할권 원칙 문서화
2. **Engine Language Grammar 확장**: 11 Core Atom 유지 하에 Temporal/Dependency 속성 및 관계식 표준화
3. **Recovery Gate Reconciliation Loop**: Novel-Novel 수습 프로토콜 구현
4. **Causal Witness Gate 구현**: Validator 및 Sovereign Engine 연동
5. **Golden Test Suite & Red-Team Verification**: R1-U 순수 의미 공격 및 복합 서순 역전 공격 완전 차단 검증

# TRPG 3.1 — Preliminary Constitutional Record: NPC Capability Continuity

## 문서의 지위

이 문서는 현재 Information Asymmetry 구현 단계에서 즉시 런타임에 편입하지 않는 **예비 헌법급 설계 원칙**을 기록한다.

- 본 문서는 설계 보존을 위한 예비 기록이다.
- 현재 런타임 권위를 갖지 않는다.
- 기존 상위 헌법 및 `SUPPLEMENTAL_CONSTITUTIONAL_DIRECTIVES.md`와 충돌할 경우 상위 규칙이 우선한다.
- 실제 구현 시 기존 Identity Continuity / Novel History / Canonical State / History 구조를 우선 재활용한다.
- 구현 시 별도 대규모 NPC 스탯 시스템을 먼저 만들지 않으며, 실제 코드 포렌식 후 최소 충분한 확장만 허용한다.
- 본 문서의 아래 조항은 이전에 논의된 Capability 설계 중 최신 방향을 기준으로 하며, 이전의 상충하는 Capability/스탯 설계 메모보다 우선하는 예비 설계 기준으로 취급한다.

---

## 제P-1조. NPC Capability의 선택적 물질화

1. 모든 NPC에게 처음부터 정규 능력치를 부여하지 않는다.
2. `NOVEL` NPC는 기본적으로 서사와 Historical Record를 통해 능력을 표현할 수 있으며, 정규화된 능력치 저장을 강제하지 않는다.
3. NPC 수가 증가할수록 스탯 데이터가 불필요하게 선형 증가하지 않도록 한다.
4. 정규 능력치가 실제 엔진 판정에 필요하거나 `CANON`으로 승격되는 경우에 필요한 Capability를 물질화할 수 있다.
5. NPC와 주인공은 Capability 원칙을 공유하되, 물질화 시점은 각자의 상태와 엔진 필요성에 따른다.

---

## 제P-2조. Capability의 권위와 LLM의 경계

1. Capability/스탯은 **엔진 소관**이다.
2. LLM은 Capability의 최종 수치나 확정된 변화를 직접 결정하는 권위를 갖지 않는다.
3. LLM이 장기간 공백에 대한 스토리 후보를 제안할 수는 있으나, 후보 안에 포함된 임의의 스탯 수치나 스탯 변화 선언은 Capability Authority가 아니다.
4. LLM은 사건·경험·훈련·부상·학습·환경 변화 등의 **변화 원인이 될 수 있는 서사 후보**를 제안하고, 엔진은 그 후보의 사건 요소와 기존 History를 근거로 Capability 변화를 산출한다.
5. 엔진이 산출한 Capability 결과는 LLM의 서사적 표현과 구별한다.

---

## 제P-3조. History 기반 Capability

1. Capability Snapshot은 NPC의 전체 History를 복제하는 별도 기억 저장소가 아니다.
2. History가 능력 변화의 근거이며 Capability Snapshot은 현재 판정용 압축 Projection이다.
3. Capability 변화는 가능한 한 authoritative Historical Record와 Canonical State에 존재하는 사건·행동·관계의 인과적 근거를 통해 산출한다.
4. Capability 자체가 Historical Truth를 대체하지 않는다.
5. Capability 계산 결과를 만들기 위해 History의 상세 서술을 Capability 저장소에 중복 기록하지 않는다.

---

## 제P-4조. 시간 경과에 의한 재평가 기준

1. Capability는 일반적으로 단기간에 반복 재계산하지 않는다.
2. **시간 경과는 매우 긴 주기의 재평가 Trigger**로 취급한다.
3. 시간 경과 자체가 기계적으로 스탯을 증감시키는 규칙으로 취급하지 않는다.
4. 장기간이 경과하여 재평가가 필요해진 경우, 그 기간 동안의 History와 현재 상태를 근거로 Capability를 재평가한다.
5. 실제 시간 임계값은 장르·세계 규칙과 기존 엔진 구조를 확인한 뒤 정하며, 기본 원칙은 짧은 주기의 반복 재평가를 피하는 것이다.
6. 예를 들어 10년이 경과하면 `힘 -X`, `지혜 +Y`를 기계적으로 적용하는 방식이 아니라, 10년 동안의 나이·훈련·경험·부상·생활·학습 등의 Canonical History를 근거로 현재 Capability를 재산출한다.

---

## 제P-5조. 사건에 의한 Capability 변화 Trigger

1. Capability에 영향을 줄 수 있는 사건은 **사건 요소(event elements)**를 통해 표시할 수 있다.
2. 엔진은 Capability에 영향을 줄 수 있도록 지정된 사건 요소를 포함하는 사건을 겪은 NPC 또는 주인공을 식별하여 관련 Capability의 재평가 또는 변화를 주도한다.
3. 사건 요소는 `신체적`, `정신적`, `인지적`, `전투`, `훈련`, `학습`, `사회적`, 기타 세계/장르별 Capability 영역 등으로 확장될 수 있으나, 구체적인 최종 분류 체계는 구현 전 포렌식으로 확정한다.
4. 사건 요소가 존재한다고 해서 항상 고정된 `+1/-1`을 즉시 적용하는 것으로 규정하지 않는다.
5. 사건은 **변화의 원인/Trigger**이고, History는 누적 근거이며, 엔진 규칙은 그 결과를 산출한다.
6. 중대한 부상, 장기간 훈련, 반복적인 실전 경험, 중요한 학습, 중대한 정신적 사건 등은 관련 Capability 재평가의 대표적인 Trigger가 될 수 있다.
7. 사건 요소가 Capability와 무관하면 Capability 재평가를 강제하지 않는다.

---

## 제P-6조. 장기간 시야 밖 인물의 Capability 연속성

1. 장기간 시야 밖에 있던 인물이 다시 현재 장면에 접근되는 경우, 그 인물에게 필요한 과거 기간의 Canonical/authoritative History를 최소 충분 범위로 검색할 수 있다.
2. 장기간 공백에 대해 LLM이 복수의 스토리 후보를 제안하는 구조를 허용한다.
3. 각 후보는 사건·경험·훈련·부상·학습 등의 변화 요소를 포함할 수 있다.
4. 엔진은 각 후보를 **후보별 Capability 결과**로 독립 평가할 수 있어야 한다.
5. 후보 평가에서 기존 Capability를 출발점으로 사용하되, LLM이 제안한 임의의 최종 스탯 수치를 그대로 채택하지 않는다.
6. 후보 중 하나가 선택되어 Canonical History로 확정될 경우, 선택된 후보의 사건 요소와 그동안의 authoritative History를 근거로 현재 Capability를 확정/갱신한다.
7. 선택되지 않은 후보의 Capability 결과는 Canonical State나 Historical Truth에 반영하지 않는다.

개념 흐름:

```text
마지막 관측/확정 Capability
        ↓
장기간 공백
        ↓
LLM: 공백 기간 스토리 후보 3~5개 제안
        ↓
Engine: 후보별 사건 요소·인과성·기존 History 평가
        ↓
후보별 Capability 결과
        ↓
선택된 후보만 Canonical Commit
        ↓
History + 현재 Capability
```

---

## 제P-7조. Canon 승격 시 History 기반 Capability 확정

1. `NOVEL → CANON` 승격 시 NPC의 능력을 임의의 현재 LLM 판단 하나로 확정하지 않는다.
2. 승격 시점까지의 authoritative Historical Record 중 해당 능력과 관련된 행동·사건·관계를 근거로 삼는다.
3. 캐논 원문에 명시된 능력과 History에서 관찰된 행동을 함께 고려할 수 있다.
4. 캐논에 직접 수치가 없는 경우 엔진 판정에 필요한 Capability는 **History-derived / Engine-derived 값**으로 구분한다.
5. Engine-derived Capability를 원작/캐논이 직접 선언한 사실인 것처럼 취급하지 않는다.
6. 승격 과정에서 Capability가 처음 물질화될 수 있으며, 이후 Capability는 Trigger 기반으로 갱신한다.

---

## 제P-8조. Canon 강등 이후 Capability Continuity

1. `CANON → NOVEL` 강등은 해당 NPC의 과거 능력 근거를 삭제하는 사건이 아니다.
2. 캐논 상태에서 확정된 Capability Snapshot은 강등 후에도 identity lineage에 종속된 속성으로 연속성을 유지할 수 있다.
3. 강등 후의 능력 표현은 더 이상 현재의 Canonical Capability와 동일한 권위로 취급하지 않는다.
4. 따라서 다음과 같이 구분한다.

```text
CANON
  canonical capability

      ↓ demotion

NOVEL
  inherited capability
```

5. 강등 이후 새로운 사건 후보나 서사적 전개가 발생하더라도 Canon Capability와 동일한 권위로 간주하지 않는다.
6. 다시 `NOVEL → CANON`으로 승격될 경우 지금까지 누적된 History와 그동안 발생한 관련 사건을 근거로 현재 Capability를 재평가할 수 있다.

---

## 제P-9조. NPC Capability와 Information Asymmetry의 연계

1. NPC Capability는 NPC가 무엇을 알고 있는지 자체를 의미하지 않는다.
2. Capability는 정보 전달·이해·관찰·추론 등 특정 능력 판정의 입력으로 사용할 수 있다.
3. 정보 획득 여부는 `sender capability + receiver capability + information element complexity + context` 등의 조건에 의해 결정될 수 있다.
4. 실제 획득된 정보의 근거는 Historical Record 및 Information relation/projection으로 보존한다.
5. Capability가 높다는 이유만으로 특정 정보를 자동으로 알고 있다고 기록하지 않는다.
6. LLM은 획득된 정보의 해석, 믿음, 의심, 오해, 기억, 감정 및 행동을 서사적으로 결정할 수 있다.

---

## 제P-10조. 저장 비용과 희소성

1. Capability는 모든 NPC에 일괄 저장하는 것을 기본값으로 삼지 않는다.
2. NOVEL NPC의 일반적인 서사적 존재를 위해 정규 스탯 테이블을 강제하지 않는다.
3. Capability Snapshot은 필요한 NPC에만 물질화할 수 있다.
4. Snapshot 안에 History의 상세 내용을 복제하지 않는다.
5. 사건 요소는 Capability 계산을 위한 최소한의 Trigger/분류 정보로 사용하며, 동일한 역사 서술을 NPC별로 중복 저장하지 않는다.
6. 별도 거대 Capability Registry를 기본 구조로 만들지 않는다.

---

## 제P-11조. 캐논 수치와 엔진 수치의 권위 구분

1. 캐논에 공식 수치가 명시되어 있다면 해당 수치의 provenance를 보존한다.
2. 캐논에 수치가 없으면 엔진이 사용하는 Capability 값은 `CANONICAL FACT`와 구별한다.
3. 서술형 캐논 근거를 엔진 판정용 값으로 정규화할 경우 그 값의 출처와 도출 성격을 구분할 수 있어야 한다.
4. LLM이 스탯 수치를 직접 생성하거나 매 턴 재생성하는 구조를 Capability의 기본 모델로 삼지 않는다.
5. 엔진은 스탯 변화의 권위자이며 LLM은 변화 원인이 될 수 있는 서사 후보의 제안자다.

---

## 제P-12조. NPC와 주인공의 동일 Capability 원칙

1. NPC와 주인공의 Capability 변화 원리는 동일한 엔진 원칙을 사용한다.
2. 주인공 역시 매 턴 스탯을 재생성하지 않는다.
3. 장기간 경과 또는 Capability-affecting Canonical Event가 발생한 경우 관련 Capability를 재평가한다.
4. 장기간 경과만으로 기계적인 스탯 증감치를 적용하지 않으며, 해당 기간의 History를 근거로 재평가한다.
5. 나이에 따른 능력 변화도 History와 현재 상태를 근거로 하며, 특정 연수마다 고정된 수치 변화를 강제하지 않는다.

---

## 제P-13조. 구현 경계와 비용 원칙

1. Capability 계산 자체에는 LLM 호출을 요구하지 않는다.
2. Capability의 재평가와 변화 산출은 가능한 한 엔진의 결정론적 규칙/계산으로 처리한다.
3. LLM 호출은 Capability 계산을 위해 직접 호출하는 것이 아니라, 장기간 공백의 스토리 후보 생성 등 실제 서사 생성이 필요한 경우에만 사용한다.
4. 사건 요소가 이미 Canonical History에 존재한다면 Capability 변화 판단을 위해 별도의 LLM 호출을 추가하지 않는다.
5. 후보별 Capability 평가 결과는 LLM에 스탯 계산을 재위임하지 않는다.

---

## 구현 보류 원칙

이 문서는 현재 Information Asymmetry Continuity 구현과 동시 강제 구현하지 않는다.

향후 구현 시 최소 조사 순서는 다음과 같다.

1. 현재 `NpcRecord` 및 NPC 관련 state 구조 재확인
2. 현재 protagonist `CharacterStats` 및 관련 상태 변경 경로 재확인
3. Canon/Novel 승격·강등 경로와 History provenance 확인
4. 기존 NPC/주인공 능력 관련 데이터가 다른 모듈에 존재하는지 전수 확인
5. 기존 Action/History 구조에서 사건 요소를 최소 변경으로 표현할 위치 확인
6. Capability 재평가 Trigger를 기존 상태 변경 경로에 최소 비용으로 연결
7. 장기간 공백 후보 생성 경로와 후보별 엔진 Capability 평가 경계 확인
8. 정보 전달 판정과 Capability의 결합이 기존 Information Asymmetry 구조를 침범하지 않는지 검증

### 최신 설계의 핵심 요약

```text
Capability = Engine Authority
History = 변화의 근거
Event Element = 변화 Trigger/원인 표지
Long Time = 희소한 재평가 Trigger
LLM = 장기간 공백의 스토리 후보 제안
Engine = 후보별 Capability 변화 산출
Canonical Commit = 선택된 후보와 결과의 확정
```

목표는 **모든 NPC를 RPG 수치화하는 것**이 아니라,

> `NOVEL은 서사로 존재 → CANON 승격 시 History를 근거로 Capability 물질화 → 장기간 공백에서는 LLM이 후보를 제안하고 엔진이 후보별 Capability를 산출 → 중대한 사건 또는 매우 긴 시간 경과 시 엔진이 Capability를 재평가 → CANON 강등 시 inherited capability로 연속 → 재승격 시 누적 History를 근거로 재평가`

라는 연속성을 보존하는 것이다.

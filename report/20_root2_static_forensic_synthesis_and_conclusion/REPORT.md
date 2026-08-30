# VEIL — Root 2 정적 포렌식 전체 과정 및 최종 결론 (Audit Record)

**문서 ID:** `AUDIT-RECORD-20-ROOT2-STATIC-FORENSIC-SYNTHESIS`  
**대상 리포지토리:** `jhy1352/3.1veil1`  
**Audit HEAD:** `797ebf2635efe23d77fa11625586d6e67fd7eb67` (and commit `7ac44ed64eff77ebb9837c5768fc0ec81ee50694`)  
**범위:** Root 2 발견 시점부터 현재까지 수행한 정적·구조적 권위 포렌식  
**Production Code Modification:** 0 lines (Strict Zero Production Modification Audit)  
**기록 일시:** 2026-08-29  

---

## I. 출발점 — Runtime에서 Root 2가 먼저 확인되었다

최초 문제는 `UPDATE_CHARACTER_STATS`였다.

Runtime Red Team에서 실제로:

```text
정상적인 사건/evidence
        ↓
UPDATE_CHARACTER_STATS
        ↓
검증 통과
        ↓
Canonical State 변경
```

이 가능한 것이 확인되었다.

따라서 출발점은 단순한 코드 냄새가 아니라:

> **실제 Runtime에서 신뢰되지 않은 근거가 Character Stat의 Canonical mutation으로 이어졌다.**

라는 것이었다.

정적 포렌식의 목적은 이 Runtime exploit의 **정확한 원인과 전체 영향 범위**를 코드 전체에서 증명하는 것이었다.

---

## II. `UPDATE_CHARACTER_STATS`의 직접적인 Validator 구조 확인

먼저 `UPDATE_CHARACTER_STATS`가 실제로 어떤 권위 조건을 요구하는지 추적했다.

결과적으로 LLM/PLAYER 모두 해당 Action을 사용할 수 있으며, 핵심적인 provenance gate는 크게 두 갈래였다.

```text
UPDATE_CHARACTER_STATS
        │
        ├── VerifiedClaim
        │
        └── verifiedEventId / grounding
```

### VerifiedClaim 경로

Claim은:

```text
entity
attribute
value
evidence
```

를 가지고 ImmigrationGate를 통과한 뒤 VerifiedClaim이 된다.

이 경로는 비교적 강하다.

실제 matching에서는:

* Entity 일치
* Attribute 일치
* Expected Value 일치

를 요구한다.

따라서 VerifiedClaim 자체를 단순히 복제하거나 `EXISTENCE` Claim을 이용해 임의 attribute를 authorize하는 것은 현재 코드상 차단된다.

---

## III. 실제 Root 2의 핵심 — Event Grounding

문제는 두 번째 경로였다.

```text
verifiedEventId
        ↓
current seeds
OR
historyRecords
OR
offscreenRecords
        ↓
ID 존재
        ↓
grounding = true
```

여기서 검증되는 것은 **Event의 의미가 아니라 ID의 존재**였다.

즉 다음 관계가 없다.

```text
Event
 ├─ 어떤 Entity인가?
 ├─ 어떤 Attribute인가?
 ├─ 어떤 Value인가?
 ├─ 어떤 방향의 변화인가?
 └─ 이 Mutation을 실제로 인과적으로 정당화하는가?
```

따라서:

```text
Event X 존재
        ↓
verifiedEventId = X
        ↓
UPDATE_CHARACTER_STATS
        ↓
stat mutation
```

이 가능하다.

이것이 기존 Runtime exploit의 **정적 원인으로 완전히 재확인**되었다.

---

## IV. Parser에서 provenance가 새로 만들어지는 문제

다음으로 Validator보다 앞단인 Parser를 추적했다.

Candidate의:

```text
statChanges
```

가 Proposal Action으로 변환될 때 현재 active seed가 자동으로:

```text
verifiedEventId
```

로 주입되는 구조를 확인했다 (`src/engine/proposalParser.ts:515-522`).

즉:

```text
Candidate.statChanges
        ↓
buildSafeProposalFromCandidate()
        ↓
첫 active seed 선택
        ↓
verifiedEventId 자동 생성
        ↓
UPDATE_CHARACTER_STATS
```

이다.

따라서 입력이 실제로 특정 사건을 제시하지 않았더라도 Parser가 **권위 credential을 합성할 수 있다.**

이것은 Runtime에서 발견된 Root 2와 정적으로 정확히 일치한다.

### 판정

**🔴 RUNTIME + STATIC CONFIRMED**

---

## V. History 구조 추적

그 다음 질문은:

> "한번 사용된 Event/evidence가 이후에도 다시 권위를 가질 수 있는가?"

였다.

Sovereign Commit을 EOF까지 추적한 결과 History Record는 Action마다 생성되며:

```text
recordId = rec-{proposal.eventId}-{index}
eventId  = proposal.eventId
```

형태를 가진다.

따라서 하나의 Proposal 안 여러 Action이 존재해도 동일한 `eventId`를 공유한다.

예:

```text
Proposal eventId = EVT-100

Action 1 → rec-EVT-100-1
Action 2 → rec-EVT-100-2
Action 3 → rec-EVT-100-3
```

모두:

```text
eventId = EVT-100
```

이다.

이 때문에 `eventId`는 **특정 Mutation을 증명하는 Action-level credential이 아니다.**

---

## VI. History Replay 확인

Validator는:

```text
history.eventId === verifiedEventId
OR
history.recordId === verifiedEventId
```

이면 grounding source로 인정한다 (`src/engine/validator.ts:1105`).

그리고 History는 append-only 구조이며:

* 소비되지 않는다.
* 만료되지 않는다.
* 특정 Mutation에 귀속되어 소진되지 않는다.

따라서:

```text
T1
Event X
 ↓
Commit
 ↓
History X

T2
verifiedEventId = X
 ↓
ALLOW

T3
verifiedEventId = X
 ↓
ALLOW

T4
verifiedEventId = X
 ↓
ALLOW
```

가 가능하다.

### 판정

**🔴 POST-COMMIT EVIDENCE REPLAY CONFIRMED**

특히 `UPDATE_CHARACTER_STATS`에는 Inventory acquisition에서 볼 수 있는 것과 같은 `consumedEventIds` 개념이 없다.

---

## VII. Seed / Offscreen이 미래 권위가 되는 구조

다음으로 `ADD_NARRATIVE_SEED`와 `RECORD_OFFSCREEN_EVENT`를 추적했다.

### 1. ADD_NARRATIVE_SEED

LLM이 이 Action을 생성할 수 있고 Commit되면:

```text
world.seeds
```

에 실제 Canonical record가 추가된다.

이후 Validator의 grounding lookup이 이 seed pool을 참조한다.

따라서:

```text
LLM
 ↓
ADD_NARRATIVE_SEED
 ↓
Canonical Commit
 ↓
Seed ID
 ↓
다음 Proposal
 ↓
verifiedEventId
 ↓
UPDATE_CHARACTER_STATS
```

라는 권위 상승 경로가 존재한다.

### 2. RECORD_OFFSCREEN_EVENT

동일하게:

```text
LLM
 ↓
RECORD_OFFSCREEN_EVENT
 ↓
Canonical offscreen record
 ↓
ID
 ↓
다음 Proposal의 grounding source
```

가 된다.

### 핵심

처음부터 외부적으로 검증된 증거였던 것이 아니라,

> **LLM이 만든 Narrative artifact가 Canonical Commit되는 순간 이후 Mutation을 정당화하는 authority source가 될 수 있다.**

### 판정

**🔴 STATIC CONFIRMED — Future Authority Escalation**

---

## VIII. Same-Proposal Self-Grounding 조사

여기서는 중요한 False Positive가 하나 제거되었다.

처음에는:

```text
ADD_NARRATIVE_SEED X
        ↓
UPDATE_CHARACTER_STATS
verifiedEventId = X
```

가 같은 Proposal 안에서 가능할 수 있는지 조사했다.

그러나 Validator는 grounding lookup에:

```text
currentState
historyRecords
```

를 사용하고, 검증 중인 Proposal의 새 `draftWorld`를 grounding source로 사용하지 않는다.

따라서 Proposal 이전에 X가 존재하지 않았다면:

```text
Action 1 → 새 Evidence 생성
Action 2 → 그 Evidence 사용
```

은 현재 `UPDATE_CHARACTER_STATS` 경로에서 차단된다.

### 판정

**🟢 BLOCKED**

이것은 취약점 목록에서 제거했다.

---

## IX. Cross-Entity Evidence 조사

다음으로:

> "A의 사건을 B의 Mutation에 사용할 수 있는가?"

를 조사했다.

### 1. VerifiedClaim

VerifiedClaim 경로는 Entity 일치를 요구한다.

따라서:

```text
NPC-A / trust / 80
        ↓
NPC-B / trust / 80
```

같은 Claim cross-entity 우회는 현재 코드상 차단된다.

### 2. Event ID

하지만 Event grounding은:

```text
verifiedEventId
        ↓
ID 존재?
```

만 확인한다.

Event의 대상 Entity와 Mutation의 대상 Character 사이에 binding이 없다.

따라서:

```text
NPC-A 관련 Event
        ↓
verifiedEventId
        ↓
Protagonist stat mutation
```

이 구조적으로 가능하다.

### 판정

**🔴 CROSS-ENTITY EVENT GROUNDING CONFIRMED**

---

## X. Cross-Action / Event Scope 문제

History의 `eventId`가 Proposal 단위이고 여러 Action이 같은 Event ID를 공유한다는 사실 때문에 추가 문제가 발생한다.

예:

```text
Proposal EVT-500

Action 1:
ADD_RUMOR

Action 2:
UPDATE_CHARACTER_STATS

Action 3:
ADVANCE_TIME
```

History는 여러 Record를 만들지만 모두:

```text
eventId = EVT-500
```

을 가진다.

따라서 미래 Validator가:

```text
verifiedEventId = EVT-500
```

만 받으면:

> 그 Event가 정확히 어떤 Action을 증명하는가?

를 알 수 없다.

즉 권위의 범위가:

```text
Action-level
```

이 아니라:

```text
Proposal/Event-level existence
```

로 압축되어 있다.

### 판정

**🔴 STATIC CONFIRMED — Cross-Action Authority Scope Gap**

---

## XI. `OVERWRITE_CHARACTER.stats`라는 별도 Mutation Surface 발견

전체 Action Surface를 확장해서 조사하면서 또 하나의 별도 문제를 발견했다.

`OVERWRITE_CHARACTER`는 실제로:

```text
incoming.stats
 ↓
allowed key
 ↓
integer
 ↓
range 1~30
 ↓
sanitizedStats
 ↓
character.stats
```

로 이어진다.

여기에는 `UPDATE_CHARACTER_STATS`와 같은 Event/Claim provenance gate가 없다.

따라서:

> **값 자체는 제한하지만, 그 값을 왜 변경할 권한이 있는지는 검사하지 않는다.**

다만 이 Action은 PLAYER 측의 정상적인 Character 편집 용도가 존재하므로 이것을 자동으로 Root 2 Runtime exploit이라고 판정하지 않았다.

### 판정

**🔴 STATIC CONFIRMED — Provenance-Free Stat Mutation Sink**

단, **Root 2 Runtime Exploit 별도 확정에는 실제 Runtime 재현이 필요**하다.

---

## XII. Legacy `utils/engineValidator.ts` 분리

구형:

```text
src/utils/engineValidator.ts
```

도 EOF까지 조사했다.

이 파일의 Candidate validation에는 stat change에 대해:

* stat 존재
* delta가 number
* NaN이 아님

정도의 검사가 있다.

하지만 그 뒤의 `projectCanonicalState()`가 실제 stat delta를 적용하지 않는 등 현재 Sovereign Commit path와 완전히 동일한 mutation pipeline이 아니다.

따라서 이것을 현재 Root 2의 Runtime 원인으로 잘못 포함시키지 않았다.

### 판정

**🟡 LEGACY STATIC RISK / CURRENT RUNTIME PATH 아님**

---

## XIII. `mutationBoundary.ts`에 대한 판정

`mutationBoundary.ts`에는 강한 방어 로직이 존재하지만 포렌식에서 중요한 것은:

> "좋은 방어 코드가 존재하는가?"

가 아니라:

> "실제 Canonical Commit 경로에서 호출되는가?"

이다.

현재 확인된 Sovereign Runtime path에서는 이것이 실제 마지막 Commit authority gate로 연결되어 있지 않았다.

따라서 존재 자체를 Runtime protection으로 계산하지 않았다.

### 판정

**⚪ NON-AUTHORITATIVE / CURRENT COMMIT PATH 아님**

---

## XIV. VerifiedClaim 자체의 방어는 별도로 보존

반대로 Claim 계층에는 실제로 강한 방어가 확인됐다.

ImmigrationGate에서:

```text
Untrusted Claim
 ↓
evidence 확인
 ↓
entity 확인
 ↓
attribute 확인
 ↓
value 확인
 ↓
conflict 확인
 ↓
VerifiedClaim
```

을 거친다.

또한 VerifiedClaim object identity를 WeakSet으로 관리한다.

따라서 단순히 JSON 구조를 복제해서:

```text
verified = true
```

같은 식으로 권위를 얻는 것은 현재 구조상 되지 않는다.

### 판정

**🟢 CLAIM FORGERY BLOCKED**

---

## XV. `EXISTENCE` Wildcard False Positive 제거

중간 조사에서 `EXISTENCE` 또는 `*` Claim이 attribute 검사를 우회할 가능성을 의심했다.

그러나 실제 `hasMatchingVerifiedClaim()` EOF 확인 결과:

```text
*
EXISTENCE
```

는 특정 attribute mutation의 권한으로 사용할 수 없도록 명시적으로 차단되어 있었다.

따라서:

```text
EXISTENCE Claim
 ↓
임의 attribute mutation
```

은 현재 코드상 Root 2 취약점으로 세면 안 된다.

### 판정

**🟢 BLOCKED**

이것 역시 최종 취약점 목록에서 제거했다.

---

## XVI. 전체 Provenance 구조 최종 형태

현재까지의 조사를 하나로 합치면 VEIL의 핵심 구조는 다음과 같다.

```text
                  AUTHORITY
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   VerifiedClaim             Event Grounding
          │                       │
 ImmigrationGate             ID existence
          │                       │
   entity/attribute/value       weak binding
          │                       │
          └───────────┬───────────┘
                      ▼
                 Mutation
                      │
                      ▼
              Canonical Commit
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       History      Seeds      Offscreen
          │           │           │
          └───────────┼───────────┘
                      ▼
              Future Grounding
                      │
                      ▼
              Future Mutation
```

즉 **강한 Claim authority와 약한 Event-ID authority가 하나의 Mutation Layer로 합쳐져 있다.**

Root 2는 이 중 약한 Event-ID authority를 공격하는 것이다.

---

## XVII. 최종 판정표

| 영역 | 최종 판정 |
| :--- | :--- |
| `UPDATE_CHARACTER_STATS` Event grounding | 🔴 **RUNTIME CONFIRMED** |
| Candidate → active seed 자동 grounding | 🔴 **RUNTIME + STATIC CONFIRMED** |
| Event 내용 ↔ mutation 의미 연결 | 🔴 **부재** |
| Event Entity ↔ mutation Entity 연결 | 🔴 **부재** |
| Event Attribute ↔ mutation Attribute 연결 | 🔴 **부재** |
| Event Value / delta ↔ mutation 연결 | 🔴 **부재** |
| Event causal direction 검증 | 🔴 **부재** |
| History `eventId` replay | 🔴 **CONFIRMED** |
| History `recordId` replay | 🔴 **CONFIRMED** |
| Evidence consumption/expiry | 🔴 **부재** |
| Cross-Entity Event grounding | 🔴 **CONFIRMED** |
| Cross-Action Event scope | 🔴 **CONFIRMED** |
| LLM Seed → future authority | 🔴 **CONFIRMED STATIC** |
| LLM Offscreen → future authority | 🔴 **CONFIRMED STATIC** |
| Same-Proposal Evidence → Stat | 🟢 **BLOCKED** |
| VerifiedClaim entity mismatch | 🟢 **BLOCKED** |
| VerifiedClaim attribute mismatch | 🟢 **BLOCKED** |
| VerifiedClaim value mismatch | 🟢 **BLOCKED** |
| `EXISTENCE` → arbitrary attribute | 🟢 **BLOCKED** |
| VerifiedClaim object forgery | 🟢 **BLOCKED** |
| LLM dice-result forgery | 🟢 **BLOCKED** |
| `OVERWRITE_CHARACTER.stats` provenance | 🔴 **STATIC CONFIRMED GAP** |
| Legacy `utils/engineValidator` | 🟡 **LEGACY RISK** |
| `mutationBoundary.ts` | ⚪ **CURRENT COMMIT PATH 아님** |
| Atomic partial commit | 🟢 **방어 확인** |

---

## XVIII. Root 2의 최종 본질

따라서 지금까지의 모든 조사를 한 문장으로 압축하면:

> **VEIL의 Root 2는 단순히 `UPDATE_CHARACTER_STATS`의 검증 누락이 아니다. Canonicalized Event/Evidence의 "존재하는 ID"가 미래 Mutation의 권위 credential로 사용되면서, 그 credential에 Entity·Attribute·Value·Causal Direction·Authority Scope·Lifetime·Consumption이 결합되어 있지 않은 구조적 provenance failure다.**

그리고 Parser는 이 문제를 한 단계 더 악화시킨다.

```text
statChanges
    ↓
active seed 자동 선택
    ↓
verifiedEventId 생성
```

때문에 **실제 의미적 근거가 없는 stat mutation에도 권위처럼 보이는 credential이 만들어질 수 있다.**

---

## XIX. 최종적으로 확정된 것과 아직 확정하지 않은 것

### 🔴 이미 Runtime까지 증명된 것
* `UPDATE_CHARACTER_STATS` Root 2
* Candidate auto-grounding 계열

### 🔴 코드 구조상 확정된 추가 영향
* Event semantic binding 부재
* Cross-Entity Event grounding
* Cross-Action Event scope
* Historical replay
* Unlimited evidence reuse
* LLM-created Seed → future authority
* LLM-created Offscreen → future authority
* `OVERWRITE_CHARACTER.stats` provenance gap

### 🟢 실제 코드 확인으로 제거된 False Positive
* Same-Proposal self-grounding
* `EXISTENCE` wildcard → arbitrary attribute
* VerifiedClaim 단순 object forgery

### 🟡 별도 조사 대상으로 남긴 것
* Legacy `utils/engineValidator`
* Name/Alias → Claim continuity의 완전한 Runtime 증명
* `OVERWRITE_CHARACTER.stats`의 실제 공격 Runtime 재현

---

## XX. 정적 포렌식 최종 상태

**Root 2 하나를 발견한 뒤 단일 Validator만 확인한 것이 아니다.**

실제 조사 범위는:

```text
Candidate
 ↓
Parser
 ↓
VerifiedClaim / ImmigrationGate
 ↓
EngineValidator
 ↓
Action ACL
 ↓
Action-specific validation
 ↓
SovereignEngine
 ↓
Draft
 ↓
Action Applier
 ↓
Canonical Commit
 ↓
History
 ↓
Seed / Offscreen
 ↓
Future grounding
 ↓
Future Mutation
```

까지 확장되었다.

따라서 현재 단계에서 **Root 2의 정적 원인과 주요 영향 범위는 충분히 폐쇄되었다.**

핵심적으로 이제 문제는:

> **"어디가 버그인가?"**

가 아니라,

> **"이 권위 체계를 어떤 최소 Diff로 재설계하면 기존 5.7/Sovereign Runtime을 보존하면서 실제 Mutation 인과권위까지 닫을 수 있는가?"**

의 단계로 넘어갈 수 있다.

**Production Code: 0줄 수정.**

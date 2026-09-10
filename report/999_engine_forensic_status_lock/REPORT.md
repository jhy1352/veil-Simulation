# VEIL Engine Forensic Status Lock

- **Report ID:** `REPORT-20260910-ENGINE-STATUS-LOCK`
- **Target repository:** `jhy1352/veil-Simulation`
- **Target branch:** `work/identity-continuity`
- **Reference commit:** `ad4b085052040608f91772d8b6dcdb82973bb9b5`
- **Purpose:** 고정된 시점에서 VEIL Engine의 기존 포렌식 항목을 `PASS / OPEN / UNKNOWN`으로 재분류한다.
- **Evidence rule:** 과거 보고서의 PASS 표기만으로 현재 PASS를 확정하지 않는다. 현재 코드와 확인 가능한 실행 증거를 우선한다.

## 1. 판정 규칙

- **PASS:** 현재 코드가 해당 불변조건을 구현하고, 관련 정적/실행 증거가 존재하며, 현재 확인 범위에서 미해결 반례가 없다.
- **OPEN:** 결함 또는 미연결 상태가 현재 코드에서 직접 확인되거나, 필수 검증이 아직 끝나지 않았다.
- **UNKNOWN:** 현재 확보된 코드/증거만으로 결론을 내릴 수 없다. 실전 런타임이 필요하면 명시한다.
- **HISTORICAL PASS:** 과거 포렌식 실행에서는 PASS였으나 현재 전체 상태의 PASS를 의미하지 않는다.

## 2. 현재 PASS로 고정하는 항목

### PASS-01 — 단일 Sovereign Commit Gate

**판정: PASS**

`SovereignEngine`이 Canonical State와 History를 소유하고 `submitProposal()`을 주권 커밋 경계로 사용하는 구조가 현재 코드에 존재한다. App의 active gameplay character update도 직접 상태를 변경하지 않고 `TransitionAction → MeaningTree → Proposal → engine.submitProposal()` 경로를 사용한다.

근거:
- `src/engine/state.ts`
- `src/App.tsx`
- `report/01_runtime_pipeline_forensics/REPORT.md`

과거 런타임 포렌식에서는 표준 턴, 인과성 없는 LLM 아이템, 플레이어 권한 상승, stale/중복 request, 변조된 세션 복원 시나리오가 모두 PASS로 기록되었다. 다만 이 항목의 의미는 **현재 커밋 경계 구조가 유지되고 있음**이라는 것이며, 모든 가능한 미래 경로의 완전성을 의미하지 않는다.

### PASS-02 — Commit-First UI 기본 경계

**판정: PASS**

App의 현재 구조는 서버에서 승인된 proposal을 받은 뒤 실제 `SovereignEngine.submitProposal()` 성공 여부를 확인하고 성공 시에만 UI 상태와 narrative message를 반영하는 Commit-First 구조를 유지한다.

근거:
- `src/App.tsx`
- `report/01_runtime_pipeline_forensics/REPORT.md`

### PASS-03 — Identity Continuity 핵심 방어

**판정: PASS**

Universal Canonical Entity Identity Continuity에 대해 과거 RED TEAM 검증에서 64/64 assertions PASS가 기록되었다. Exact Match, ID 누락 복구, AMBIGUOUS/CONFLICT fail-closed, 신규 엔티티 ID 엔진 독점 발급, NPC/Faction/Seed/Character continuity, EOF pipeline 및 adversarial identity 공격이 포함되었다.

근거:
- `report/05_universal_entity_identity_continuity/REPORT.md`
- `src/engine/index/entityIdentityResolver.ts`
- `src/engine/index/entityIdentityResolverTest.ts`

**주의:** 이는 identity subsystem에 대한 강한 PASS 증거이며, 장기 전체 시스템의 모든 연계 경로가 완성됐다는 뜻은 아니다.

### PASS-04 — Passport projection authority boundary

**판정: PASS**

Passport는 Canonical State/Immutable History에서 파생되는 projection이며 별도 권위로 승격되지 않는다. Canon↔Novel lineage, retired 상태, reference extraction, EOF 이후 projection 및 deterministic ordering/deep immutability에 대해 85/85 assertions PASS가 기록되었다.

근거:
- `report/09_identity_continuity_passport_verification/REPORT.md`
- `src/engine/index/passport.ts`

### PASS-05 — Hydration fail-closed / replay provenance 구조

**판정: PASS (구조), 장기 저장 안정성은 별도 OPEN**

현재 `SovereignEngine.hydrate()`는 snapshot schema, history temporal monotonicity, stateVersion progression, previousStateHash provenance, proposal grouping, deterministic canonical action replay, genesis anchoring 등을 검증한 뒤 engine을 복원한다.

근거:
- `src/engine/state.ts`
- `report/01_runtime_pipeline_forensics/REPORT.md`

여기서 PASS는 **저장 데이터가 검증을 통과할 때 복원이 엄격하게 검증되는 구조**를 의미한다. localStorage 저장 실패 자체는 아래 OPEN 항목이다.

### PASS-06 — Candidate external metadata allow-list / engine-owned ID protection

**판정: PASS (정적 구조)**

현재 Candidate Recovery Gate는 LLM candidate의 `rawMetadata` 외부 필드 allow-list를 사용하고 engine-owned `resolvedEntityId`를 외부 candidate가 직접 공급하지 못하도록 차단한다.

근거:
- `src/engine/language/candidateRecoveryGate.ts`

### PASS-07 — Candidate별 독립 격리 원칙

**판정: PASS (정적 구조)**

Candidate Recovery Gate는 개별 candidate를 독립 평가하고 손상 candidate를 quarantine하는 구조를 명시한다. 한 candidate의 corruption이 다른 candidate를 연쇄적으로 무효화하지 않도록 설계되어 있다.

근거:
- `src/engine/language/candidateRecoveryGate.ts`

## 3. 현재 OPEN 항목

### OPEN-01 — Recovery EOF unterminated-string auto-close

**판정: OPEN / FAIL**

현재 `src/engine/language/recovery.ts`의 `balanceUnclosedBrackets()`는 EOF에서 `inString === true`이면 `suffix += '"'`를 수행한다. 이는 사용자가 요구했던 "의미를 발명하지 않는 EOF 복구" 원칙과 충돌한다. 문자열 종료를 자동 삽입하는 것은 단순 bracket closure가 아니라 손상된 문자열의 의미를 변경할 가능성이 있다.

따라서 이전 대화에서 "수정 완료"로 취급했던 이 항목은 **현재 코드 기준으로 PASS가 아니다.**

필요 조치:
- unterminated string at EOF는 fail-closed.
- uniquely determinable structural bracket closure만 허용.
- 수정 후 dedicated regression test와 read-back verification 필요.

### OPEN-02 — Causal Language runtime integration

**판정: OPEN**

`src/engine/language/causalCompiler.ts`는 deterministic compiler 구현을 포함하지만, 현재 확보한 코드 증거만으로 실제 LLM runtime의 모든 자연어 입력이 이 compiler를 거쳐 Canonical proposal로 연결된다는 사실을 확정할 수 없다.

특히 `parseNaturalLanguageToEvents()`는 현재 알려진 한국어 표현 패턴 중심의 pattern parser이며 `Date.now()` 기반 eventId도 사용한다. 따라서 파일 존재 자체는 runtime integration 증거가 아니다.

**실전 런타임 필요:** 실제 `Gemini → candidate → causal compilation → MeaningTree/Proposal → PreAuth → Sovereign Commit` 경로를 trace해야 한다.

### OPEN-03 — Triage runtime integration

**판정: OPEN**

현재 확보한 코드에서는 Candidate Recovery Gate가 Recovery를 직접 호출하는 것은 확인되지만, Triage가 실제 LLM runtime candidate path에 연결되어 있다는 결정적 호출 경로는 확인되지 않았다. 따라서 "Triage가 실제 런타임에서 작동한다"고 PASS 처리하면 안 된다.

**실전 런타임 필요:** 실제 server request 한 턴을 기준으로 Triage invocation 및 결과가 PreAuth 이전에 반영되는지 trace해야 한다.

### OPEN-04 — localStorage 전체 SessionPayload 장기 확장성

**판정: OPEN / P0**

현재 `src/App.tsx`는 `character`, `worldInfo`, `messages`, `engineState`, `storyTurnCount`, `selectedModel`, `genesisSnapshot` 등을 하나의 `SessionPayload`로 JSON stringify하여 localStorage에 저장한다.

저장 실패는 현재 `console.warn()`으로 끝난다. 따라서 저장이 실패해도 in-memory canonical world가 계속 진행될 수 있고, 이후 새로고침에서 이전 저장본을 읽게 되는 split-brain 위험이 존재한다.

근거:
- `src/App.tsx`

이 문제는 단순 성능 문제가 아니라 **장기 세계 보존 신뢰성 문제**다.

### OPEN-05 — Narrative Authority Gap

**판정: OPEN / P1**

Canonical commit이 성공했다는 것과 LLM이 생성한 최종 narrative prose가 canonical facts를 정확히 표현한다는 것은 별개의 문제다. 현재 확보된 구조에서는 Commit-First UI는 존재하지만, commit 이후 표시되는 raw narrative에 대해 deterministic canonical claim validation이 완성되었다는 증거가 없다.

따라서:
- Commit Gate = PASS
- Narrative Truth Gate = OPEN

으로 분리해야 한다.

### OPEN-06 — Long-context Canonical Context continuity

**판정: OPEN / P1**

현재 App은 대화 messages를 서버로 전달하고 server 측 최근 메시지 window에 의존한다. 알려진 구조상 `messages.slice(-20)` 기반 window가 장기 플레이에서 Canonical State/World Rules의 전체 권위를 매 요청 보장하는지 별도 보장이 없다.

따라서 장기 턴에서 이전 narrative context가 canonical context보다 앞에 오거나 canonical context가 누락되는 경우를 별도로 검증해야 한다.

**실전 런타임 필요:** 20+ turns를 넘기는 실제 request trace가 필요하다.

### OPEN-07 — Candidate max-5 overflow detection

**판정: OPEN / P1**

현재 `parseCandidatesBlock()`은 `rawList.slice(0, 5)`를 먼저 수행한다. 따라서 LLM이 6개 이상 후보를 출력했는지 downstream에서 원본 overflow를 검출해야 한다면 원본 count가 이미 손실된다.

현재 코드상 max 5 enforcement는 존재하지만 **overflow detection 자체가 보존되지 않는 구조적 결함**이 있다.

### OPEN-08 — originInputId provenance fallback

**판정: OPEN / P1**

기존 포렌식에서 `buildSafeProposalFromCandidate()`의 `originInputId || candidate.candidateId` fallback이 확인되었다. caller가 originInputId를 누락하면 candidateId가 input provenance처럼 사용될 수 있다.

원칙상 input provenance와 candidate identity는 서로 다른 namespace여야 한다.

필요 조치:
- originInputId 필수화 또는 명시적 UNKNOWN/REJECT.
- candidateId fallback 제거.

### OPEN-09 — History / Passport / Identity / Inventory historical scan scaling

**판정: OPEN / P1/P2**

Passport projection과 여러 validator가 `historicalRecords`를 반복 scan/sort하는 구조가 남아 있다. 현재 correctness가 즉시 깨진다는 증거는 없지만, 장기 history에서 시간/메모리 비용이 누적될 수 있다.

이는 correctness PASS와 별개로 long-term performance OPEN이다.

## 4. UNKNOWN / 미확정

### UNKNOWN-01 — 100k+ turn practical stability

현재 코드 구조만으로 100k turns의 실제 브라우저/localStorage/runtime 안정성을 PASS할 수 없다.

### UNKNOWN-02 — 최종 Narrative Quality

현재 엔진의 canonical integrity와 narrative quality는 별개의 문제다. 동일 World Preset/character/action sequence에 대해 Gemini 3.5 Flash Run 1/Run 2에서 high-level story skeleton convergence가 관측되었으므로 "항상 완전히 새로운 이야기" 요구는 현재 FAIL이다. 이는 엔진 권위 구조의 FAIL과 동일하지 않지만, 최종 narrative layer의 OPEN 문제다.

### UNKNOWN-03 — Full runtime Causal Compiler coverage

causalCompiler 자체의 static implementation은 확인되었으나 실제 전체 runtime 입력 분포에 대한 coverage는 아직 확정되지 않았다.

## 5. Historical PASS evidence that must not be overgeneralized

다음은 강한 과거 PASS 증거지만, 현재 전체 엔진을 자동으로 GREEN으로 만드는 증거는 아니다.

- `report/01_runtime_pipeline_forensics/REPORT.md`: 5/5 runtime scenarios PASS.
- `report/05_universal_entity_identity_continuity/REPORT.md`: 64/64 PASS.
- `report/09_identity_continuity_passport_verification/REPORT.md`: 85/85 PASS.
- `ad4b085052040608f91772d8b6dcdb82973bb9b5`: Gemini 3.5 Flash Run 1/Run 2 raw convergence evidence preserved.

## 6. Locked conclusion

### Current PASS

- Sovereign Commit Gate architecture
- Commit-First UI boundary
- Identity Resolver / Entity Continuity subsystem
- Passport as projection, not authority
- Hydration fail-closed / deterministic replay architecture
- Candidate external metadata firewall
- Candidate isolation structure

### Current OPEN

- Recovery EOF unterminated-string handling
- Causal Language runtime integration
- Triage runtime integration
- localStorage long-term persistence / save-failure integrity
- Narrative post-commit factual authority gate
- Long-context canonical context continuity
- Candidate overflow detection
- originInputId provenance fallback
- historical scan/projection scaling

### Current UNKNOWN

- Practical 100k+ turn stability
- Full causal compiler runtime coverage
- Final narrative quality / anti-convergence success

## 7. Operational rule

이 보고서의 목적은 "VEIL이 완성됐다"고 선언하는 것이 아니다. 이후 작업에서 이미 검증된 PASS를 불필요하게 다시 FAIL로 되돌리지 않으면서, OPEN 항목을 실제 코드/실행 증거로 하나씩 닫기 위한 **상태 기준선(status lock)**이다.

다음 변경은 반드시 이 보고서의 OPEN/PASS 분류와 실제 코드/실행 결과를 함께 갱신해야 한다.

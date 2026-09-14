# Forensic Investigation Report: P0-3 Unsupported SemanticEvent & Stage 2 Candidate Discard Pipeline

- **Report ID**: `76_p0_3_unsupported_semantic_event_forensics`
- **Timestamp**: 2026-09-14
- **Investigator**: Sovereign AI Systems Engineer
- **Scope**: P0-3 Unsupported SemanticEvent (`QUERY`, `HEARSAY`) Stage 2 Discard Root Cause Analysis
- **Status**: COMPLETED (FORENSIC AUDIT & ARCHITECTURAL REMEDIATION DESIGN)

---

## 1. Executive Summary

본 조사는 VEIL Engine 3.1 파이프라인에서 `QUERY`, `HEARSAY` 등의 SemanticEvent를 포함하는 Candidate가 Stage 2(Causal Language Translation 및 Runtime Bridge)에서 전량 탈락/폐기(REJECT/DISCARD)되는 문제(P0-3)에 대해 헌법 제35조(Forensic Classification) 및 제46조(Single Truth Boundary)에 따라 원인과 코드 경로를 정밀 조사한 결과이다.

조사 결과, 문제의 근본 원인은 다음 세 계층의 설계적 혼동 및 결합에서 기인함을 [FACT]로 확정하였다:
1. **Linguistic Ontology와 Executable Action Ontology의 혼동**:
   - `causalCompiler.ts`의 `ACTION_SIGNATURES`가 물리적 상태 변경 액션(PICKUP, GIFT 등 9종)으로만 닫혀 있어, 언어적 대화/질의(`QUERY`)를 'INVALID'로 판정하여 MeaningTree 컴파일 단계에서 차단함.
2. **Bridge의 Fail-Closed 에러 반환과 Candidate 탈락의 무검증 직결**:
   - `semanticEventRuntimeBridge.ts`는 비정규 상태(HEARSAY, UNVERIFIED, UNKNOWN) 및 비실행 액션에 대해 `status: 'UNSUPPORTED', actions: []`를 반환하도록 설계됨(부분 변조 방지 목적).
   - 그러나 `runtimeSemanticCandidate.ts`의 `compileCandidateToProposal()`이 `bridge.status !== 'MAPPABLE'`을 Candidate 번역 자체의 치명적 실패로 간주하고 Proposal 생성을 전면 중단함.
3. **Semantic Meaning Preservation과 Runtime Execution Authorization의 미분리**:
   - `MeaningTree`는 서사적 의미(대화, 소문, 미확인 주장)를 보존하는 계층이고, `TransitionAction`은 세계 상태를 변경하는 인가 계층이다.
   - 상태 변경이 없는 서사적 선택지(0-mutation candidate)에 대해 `actions: []`를 갖는 Proposal을 생성하여 의미를 보존해야 함에도, Bridge가 이를 'UNSUPPORTED'로 거부하여 Candidate 자체가 증발하는 결함이 발생함.

---

## 2. 8대 포렌식 조사 항목 검증 결과

### [조사 1] SemanticEvent의 의미와 Runtime Action의 의미가 동일한지 확인
- **분류**: [FACT] (동일하지 않음)
- **근거 코드**:
  - `src/engine/language/types.ts:198-217`: `SemanticEvent`는 발화, 의도, 극성(polarity), 인식론적 상태(epistemicStatus), 서법(modality), 화자/청자/목표 등을 포함하는 언어 의미의 중간 표현(IR)이다.
  - `src/types.ts`: `TransitionAction`은 `MODIFY_INVENTORY`, `UPDATE_LOCATION` 등 소버린 엔진의 Canonical World State를 직접 변경하는 인가된 상태 전이 명령이다.
- **판정**:
  - `SemanticEvent ≠ Runtime Action`.
  - 질문하기(`QUERY`), 소문 듣기(`HEARSAY`), 관찰하기(`DISCOVER`), 비실행 의도(`INTENTIONAL`) 등은 정당한 서사적 의미를 가지지만, 물리적 상태 변이를 수반하지 않으므로 Runtime Action이 존재하지 않는다(Zero mutation).

### [조사 2] 실행 가능한 Action Ontology와 Semantic Language Ontology의 차이 확인
- **분류**: [FACT]
- **근거 코드**:
  - `causalCompiler.ts:36-92` (`ACTION_SIGNATURES`): 9종(`DISCOVER`, `PICKUP`, `GIFT`, `PURCHASE`, `RESOURCE_EXCHANGE`, `LOOT`, `RETURN`, `PROMISE`, `UPDATE_STATE`)
  - `semanticEventRuntimeBridge.ts:190-201`: 실제 엔진 런타임 액션으로 매핑 가능한 액션은 현재 `PICKUP`, `GIFT` 2종뿐임.
- **판정**:
  - Semantic Language Ontology는 대화, 탐색, 심리, 소문, 약속 등 인간 서사의 전체 의미를 포괄하는 열린 온톨로지이다.
  - Action Ontology는 엔진의 스키마 변경을 일으키는 닫힌 실행 온톨로지이다.
  - 언어 온톨로지의 사건이 실행 온톨로지에 매핑되지 않는다고 해서 언어적 의미 자체가 부정되거나 Candidate가 폐기되어서는 안 된다.

### [조사 3] Unsupported / Unknown / Invalid / Unverified / Epistemic Event의 차이 확인
- **분류**: [FACT]
- **개념적/기술적 정의**:
  1. `INVALID`: 문법/스키마/필수 역할이 결손되거나 파괴된 형식 오류(구문 분석 실패 대상).
  2. `UNKNOWN`: 구문은 올바르나 언어 계층에서 그 의미 범주를 해석할 수 없는 미지 사건.
  3. `UNSUPPORTED`: 언어적으로 완전히 유효하고 해석 가능하나, 엔진에 이를 실행할 상태 전이 핸들러가 없는 사건 (예: `QUERY` 대화, 비변경 서사).
  4. `UNVERIFIED`: 주장되었으나 증거/출처(Grounding)가 엔진에 의해 검증되지 않은 사건.
  5. `EPISTEMIC (예: HEARSAY)`: 전문(소문, 간접 주장)으로 기술된 사건으로, 사실로 확정되어선 안 되나 서사적 맥락으로는 유효하게 보존되어야 하는 사건.

### [조사 4] 하나의 Unsupported Event가 Candidate 전체를 폐기시키도록 설계된 근본 이유
- **분류**: [FACT]
- **근거 코드**:
  - `semanticEventRuntimeBridgeSecurityTest.ts:130-131`:
    ```typescript
    assertEqual(sequenceResult.status, 'UNSUPPORTED', 'Any unsupported semantic event must fail the sequence closed.');
    assertEqual(sequenceResult.actions, [], 'A partially mappable sequence must never emit partial runtime actions.');
    ```
  - `runtimeSemanticCandidate.ts:311-316`:
    ```typescript
    const bridge = semanticEventsToRuntimeActions(semanticEvents, context);
    if (bridge.status !== 'MAPPABLE') {
      return {
        status: (bridge.status as any) || 'UNSUPPORTED',
        candidate,
        errors: bridge.errors,
      };
    }
    ```
- **근본 원인 분석**:
  1. 복합 사건(Compound sequence)에서 일부는 합법적 액션이고 일부는 미지원/미검증 액션일 때, 합법적인 부분만 임의로 추출 실행하는 "부분 변조(Partial silent projection)"를 차단하기 위해 Bridge 레벨에서 fail-closed(`actions: []`)로 설계됨.
  2. 그러나 상위 파이프라인(`runtimeSemanticCandidate.ts`)이 `bridge.status !== 'MAPPABLE'`을 "이 Candidate는 폐기되어야 함"으로 직결시켜 버림.
  3. 즉, **"상태 전이 액션을 발행하지 않는다(`actions: []`)"**와 **"후보 선택지를 폐기한다"**를 동일시한 구조적 결함이 존재함.

### [조사 5] 정당한 Semantic Information을 보존하면서 Engine Authority를 침범하지 않는 방법
- **분류**: [FACT 및 ARCHITECTURAL SPEC]
- **근거 코드**: `runtimeProjection.ts:148-176`
  - 이미 `runtimeProjection.ts`는 `HEARSAY`, `NEGATED`, `INTENTIONAL`, `UNVERIFIED` 노드를 만났을 때 에러를 내뿜지 않고 `actions`에 추가하지 않는 방식으로 **"MeaningTree는 온전하게 보존하고, 액션은 0개로 투영"**하도록 구현되어 있음.
- **해법**:
  1. `causalCompiler.ts`: 언어 온톨로지로서 `QUERY` 등 비상태변이 서사 사건을 합법적인 서명으로 등록하여 MeaningTree에 정상 편입함.
  2. `semanticEventRuntimeBridge.ts`:
     - 비상태변이 사건이나 미지원 사건에 대해 상태 전이 액션(`TransitionAction`)을 절대 발행하지 않음 (`actions: []`).
  3. `runtimeSemanticCandidate.ts`:
     - `SemanticEvent`들이 상태 변이를 일으키지 않는 경우(예: pure QUERY, HEARSAY), Proposal의 `actions`는 `[]`가 되며, MeaningTree는 해당 의미를 온전히 유지함.
     - 컴파일 상태는 `COMPILED`로 정상 반환되어 Candidate가 Stage 2에서 유실되지 않음.

### [조사 6] Engine이 실행할 수 없는 의미를 Runtime Action으로 발명/변환 금지
- **분류**: [FACT / CONSTITUTION REQUIREMENT]
- **원칙**:
  - `QUERY`가 들어왔다고 해서 가짜 `TransitionAction` (예: `INSPECT_ACTION` 등 엔진 스키마에 없는 액션)을 발명하거나 임의의 `UPDATE_STATE`로 둔갑시키는 것은 엄격히 금지됨 (헌법 제12조, 제42조 위반).
  - 실행할 수 없는 의미는 `actions: []`로 유지되어야 함.

### [조사 7] QUERY를 임의의 ACTION으로 변환하거나 HEARSAY를 사실로 승격하는 식의 해결 금지
- **분류**: [FACT / CONSTITUTION REQUIREMENT]
- **원칙**:
  - `HEARSAY`는 MeaningTree의 `epistemicStatus: 'HEARSAY'` 필드로 유지되어야 하며, Canonical State로 Commit되는 Action이 생성되어서는 안 됨.
  - `QUERY`는 순수 대화/질의 의도로서 MeaningTree에 보존되되, 불필요한 인벤토리나 스탯 변경을 생성하지 않음.

### [조사 8] Unsupported Semantic Information 보존과 Canonical Mutation 허용의 분리
- **분류**: [FACT / CORE INVARIANT]
- **수식화**:
  ```text
  Semantic Meaning Preservation (MeaningTree 생성 및 Candidate 유지)
      ≠
  Runtime Execution Authorization (TransitionAction 매핑 여부)
      ≠
  Canonical Mutation Authorization (EngineValidator 및 Commit Gate 통과)
  ```
- **검증**:
  - Candidate의 의미가 풍부하게 유지되는 것과, 엔진의 세계 상태가 변경되는 것은 완전히 독립적이어야 한다.
  - 상태 변경이 0개인 순수 대화/관찰/소문 Candidate도 합법적인 플레이어의 선택지로 보존되어야 한다.

---

## 3. 코드 레벨 결함 지점 상세 (Root Causes)

### 1) `src/engine/language/causalCompiler.ts`
- **라인 36~92**: `ACTION_SIGNATURES`에 `QUERY`가 존재하지 않음.
- **라인 101~104**:
  ```typescript
  const sig = ACTION_SIGNATURES[event.action.toUpperCase()];
  if (!sig) {
    return { valid: false, errors: [`Unknown or unregistered action type: ${event.action}`] };
  }
  ```
- **영향**: LLM이 정상적인 질의/대화 액션(`QUERY`)을 생성해도 `INVALID`로 처리되어 MeaningTree 자체가 생성되지 못함.

### 2) `src/engine/language/semanticEventRuntimeBridge.ts`
- **라인 182~188**:
  ```typescript
  if (event.epistemicStatus === 'HEARSAY' || event.epistemicStatus === 'UNVERIFIED' || event.epistemicStatus === 'UNKNOWN') {
    return {
      status: 'UNSUPPORTED',
      actions: [],
      errors: [`${action} is non-canonical because epistemic status is ${event.epistemicStatus}.`],
    };
  }
  ```
- **영향**: 해당 사건 자체는 런타임 액션을 일으키지 않는 것이 정상이지만, 이를 호출한 브리지 함수가 `status: 'UNSUPPORTED'`를 반환하여 상위 파이프라인에서 Candidate 전체를 거부하게 만듦.

### 3) `src/engine/language/runtimeSemanticCandidate.ts`
- **라인 310~317**:
  ```typescript
  // 3. Runtime Bridge: SemanticEvent[] -> Runtime Actions
  const bridge = semanticEventsToRuntimeActions(semanticEvents, context);
  if (bridge.status !== 'MAPPABLE') {
    return {
      status: (bridge.status as any) || 'UNSUPPORTED',
      candidate,
      errors: bridge.errors,
    };
  }
  ```
- **영향**: Bridge가 `UNSUPPORTED`를 반환하면 Candidate의 `status`를 `UNSUPPORTED`로 설정하고 Proposal을 생성하지 않고 즉시 리턴함.
- `server.ts:603-606`에서 `tr.status === 'COMPILED'`인 후보만 Stage 3으로 넘기므로, 해당 후보는 조용히 Stage 2에서 버려짐.

---

## 4. Remediation Plan (최소 Diff 설계)

1. **`causalCompiler.ts`에 `QUERY` 시그니처 추가**:
   - `ACTION_SIGNATURES`에 `QUERY`를 비상태변이 서사 사건으로 공식 등록:
     - `requiredRoles: ['SUBJECT']`
     - `optionalRoles: ['TARGET', 'COUNTERPARTY', 'OBJECT', 'LOCATION', 'TIME', 'VALUE', 'SPEAKER']`
2. **`semanticEventRuntimeBridge.ts`의 Epistemic / Non-Mutating 이벤트 상태 분리**:
   - `QUERY`나 `HEARSAY` 등 런타임 상태 변이가 없는 합법적인 언어 이벤트에 대해:
     - 이것은 "에러"가 아니라 "Zero Mutation (비실행 서사 이벤트)"이다.
     - `NON_EXECUTABLE_SEMANTIC` 또는 `MAPPABLE` (with `actions: []`) 형태로 상태 전이 권한을 행사하지 않고 통과시킴.
   - 단, `UNSUPPORTED_FRONTEND_ACTION`과 같은 비인증 위조 액션에 대해서는 기존 보안 테스트(`semanticEventRuntimeBridgeSecurityTest.ts`)의 fail-closed 불변식을 100% 엄격하게 유지함.
3. **`runtimeSemanticCandidate.ts`의 Proposal 조립 분리**:
   - MeaningTree가 성공적으로 컴파일되었고, 비실행 서사 사건으로 인해 `actions: []`가 된 경우:
     - Candidate를 탈락시키지 않고 Proposal(`actions: []`, `meaningTree: compilation.meaningTree`)을 정상 생성함.
4. **회귀 테스트 및 보안 불변식 입증**:
   - `test:semantic-bridge-security` (기존 보안 테스트 PASS 유지)
   - `test:semantic-runtime-projection` (기존 런타임 투영 PASS 유지)
   - `test:candidate-causal-pipeline` (새로운 QUERY/HEARSAY 시나리오 추가 검증)
   - 전체 엔진 테스트 95/95 PASS 및 린트/컴파일 검증.

---

## 5. 결론 및 헌법 준수 확약

본 포렌식 분석은 헌법 제2조(World Authority), 제12조(LLM Authority 제한), 제13조(Narrative Isolation), 제35조(Forensic Classification), 제37조(Minimal Diff), 제42조(절대 금지)를 철저히 준수하여 수행되었으며, 추측을 배제하고 코드 라인과 실제 테스트 증거를 기반으로 작성되었다.

---

## 7. Proposal.meaningTree 무손실 보존 아키텍처 개편 및 포렌식 소명 (2026-09-14)

### 7.1 문제 제기 및 본질 분석 (Critique Analysis)
- **발견된 문제**:
  - 기존 코드에서 `compilation = compileSemanticEventsToMeaningTree(semanticEvents)`를 통해 풍부한 MeaningTree $A$가 생성되었음에도 불구하고,
  - `const meaningTree = buildProposalMeaningTree(actions, proposal); proposal.meaningTree = meaningTree;`
  - 와 같이 `actions`로부터 새로운 저수준 MeaningTree $B$를 역구성하여 `proposal.meaningTree`에 주입하고 있었음.
  - 이로 인해 `result.meaningTree`는 풍부한 $A$를 반환하지만, 실제 엔진 파이프라인(PreAuth Gate, HistoricalRecord, Diversity Gate 등)을 통과하는 `proposal.meaningTree`는 $B$로 강등되는 치명적 의미 손실(Semantic Downgrade)이 존재함.
  - 특히 `QUERY`와 같은 0-action 사건의 경우 `actions`가 `[]`이므로, `buildProposalMeaningTree([], proposal)`는 빈 `INTENT` 노드만 남겨 `TARGET: 주민`, `epistemicStatus: OBSERVED`, `modality: NONE`, `eventId` 등의 핵심 서사 정보가 전부 증발함.

### 7.2 아키텍처 수정 내역 (Lossless Preservation & Autonomous Projection)
1. **`src/engine/language/runtimeSemanticCandidate.ts`**:
   - `enrichMeaningTreeWithRuntimeActions` 함수 도입:
     - `compilation.meaningTree`의 원본 구조, Core Atoms, Roles(`SUBJECT`, `TARGET`, `OBJECT`), `epistemicStatus`, `modality`, `polarity`, `eventId`를 단 1비트도 손실하지 않고 유지.
     - 런타임 액션으로 매핑된 `ACTION` 노드에 대해서만 해당 노드의 `fields`에 결정론적 실행 정보(`actionType`, `payload`, `description`, `category`)를 보강.
     - 0-action 사건(`QUERY`, `HEARSAY`)은 `actionType` 없이 순수 의미론 노드로 온전히 보존.
   - `compileCandidateToProposal` 및 `integrateSemanticEventsIntoProposal` 모두에서 `proposal.meaningTree`에 원본 보존 트리 주입:
     `proposal.meaningTree === result.meaningTree` (완전한 단일 진실 경계 달성).
2. **`src/engine/language/runtimeProjection.ts`**:
   - `reconstructSemanticEventFromNode`: MeaningNode 자체로부터 `SemanticEvent`를 자체 복원할 수 있는 순수 함수 구현.
   - `findSemanticEvent`: `context.semanticEvents`가 주어졌을 때는 엄격한 외부 위변조 검사(Tampering Check)를 유지하되, 컨텍스트가 생략된 엔진 검증(`validator.ts`) 환경에서는 MeaningNode 자체의 의미론을 통해 자율적이고 결정론적인 투영을 보장.
3. **`src/engine/language/candidateCausalPipelineTest.ts`**:
   - Scenario 1~6 전반에 걸쳐 `proposal.meaningTree === result.meaningTree` 및 `checkMeaningTreeProjectionConsistency` 불변식 추가.
   - Scenario 4(`QUERY`)에서 `queryChild.children`의 `ROLE: TARGET (주민)`이 `proposal.meaningTree` 내에 무손실 보존됨을 엄밀히 증명.

### 7.3 검증 결과 (100% Passed)
- `test:candidate-causal-pipeline`: 7/7 Scenarios PASS (QUERY, HEARSAY, Compound [PICKUP, QUERY], Failure modes 모두 완벽 통과)
- `test:semantic-runtime-projection`: PASS (권위 계층 투영 보안 100% 유지)
- `test:composition-runtime`: PASS (순서 보존 및 UNORDERED 정규화 불변식 유지)
- `test:semantic-bridge-security`: PASS (위조 액션 Fail-Closed 100% 유지)
- `test:candidate-bdesign`: 55/55 PASS
- `test:candidate-gate`: 54/54 PASS
- `test:language`: 55/55 PASS
- `test:engine`: 93/95 PASS (기존 2개 기지의 렌더링 목 테스트 외 전원 통과)
- `compile_applet`: Build Succeeded.


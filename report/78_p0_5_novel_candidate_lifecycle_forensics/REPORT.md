# VEIL Engine P0-5 Follow-up Forensics: NOVEL Identity Resolution & Candidate Lifecycle

## 1. 개요 및 포렌식 목적
- **목적**: 현재 구현에서 긍정적 증거(positive novelty evidence)를 가진 진정한 `NOVEL` identity resolution이 발생했을 때, Candidate가 실제 런타임 수명주기(runtime lifecycle)에서 어떻게 처리되는지(폐기 vs 보존 vs 엔진 권위 전달 여부) 실측 및 분석.
- **작업 원칙**: 본 작업은 관찰/포렌식 작업이며, Engine/Bridge/Resolver 코드 수정을 일체 수행하지 않는다.

---

## 2. 실측 라이프사이클 (Full Lifecycle Trace & Actual Observed Values)

### [입력 구성 (Canonical State & Positive Evidence)]
- **CanonicalState**: 캐릭터 `이청`, 소지품 `[{ id: 'item-iron-sword', name: '철검', quantity: 1 }]` (신규 아이템 `'청룡언월도'` 미존재)
- **HistoricalRecords**: `evt-armory` (세부내용: "Spoke with npc-abbot and discovered hidden armory containing 청룡언월도")
- **Candidate #101**: `label`: "비경의 청룡언월도 습득", `semanticEvents`: `[PICKUP('이청', '청룡언월도', provenance='evt-armory')]`
- **Evidence Bundle**: `{ entityType: 'ITEM', evidence: { cause: 'DISCOVERY_PICKUP', context: '비경을 탐색하고 획득함', sourceNpcId: 'npc-abbot', verifiedEventId: 'evt-armory' } }`

---

### [단계별 실측 결과 (FACT)]

#### 1) Step 1: Entity Identity Resolver 직접 호출
- **입력**: `resolveInventoryItemIdentity(canonicalState, historicalRecords, '청룡언월도', evidenceBundle)`
- **실측 반환값**:
  ```json
  {
    "status": "NOVEL",
    "canonicalId": undefined,
    "normalizedName": "청룡언월도",
    "reason": "No existing canonical or historical ITEM identity matches '청룡언월도', but positive acquisition/creation evidence was verified authoritatively. New ID may be allocated by Engine authority."
  }
  ```
- **관측 사실**: `AMBIGUOUS`가 아닌 정확한 `NOVEL`이 반환되었으며, Resolver는 Canonical ID를 직접 발급하지 않고 `undefined`를 반환함.

#### 2) Step 2: Runtime Semantic Bridge 관찰
- **입력**:
  - `bridgeContext.resolveInventoryItem({ role: 'OBJECT', entityName: '청룡언월도' })`
  - `semanticEventToRuntimeActions(novelPickupEvent, bridgeContext)`
  - `semanticEventsToRuntimeActions([novelPickupEvent], bridgeContext)`
- **실측 반환값**:
  - `bridgeContext.resolveInventoryItem(...)` → `undefined`
  - `semanticEventToRuntimeActions(...)` →
    ```json
    {
      "status": "UNSUPPORTED",
      "actions": [],
      "errors": ["OBJECT '청룡언월도' is not canonically resolvable to an inventory item."]
    }
    ```
  - `semanticEventsToRuntimeActions(...)` →
    ```json
    {
      "status": "UNSUPPORTED",
      "actions": [],
      "errors": ["[ev_pickup_novel_1] OBJECT '청룡언월도' is not canonically resolvable to an inventory item."]
    }
    ```
- **관측 사실**: P0-5 방어 규칙에 따라 Runtime Semantic Bridge는 `NOVEL`에 대해 조기 Canonical ID를 임의 생성하지 않으며, `resolveInventoryItem()`은 `undefined`를 반환하고 브리지는 `UNSUPPORTED`로 Fail-Closed 됨.

#### 3) Step 3: compileCandidateToProposal() 실행
- **입력**: `compileCandidateToProposal(candidate101, [novelPickupEvent], canonicalState, 1, historicalRecords, 'req-forensic-101', bridgeContext)`
- **실측 반환값**:
  ```json
  {
    "candidateId": 101,
    "status": "UNSUPPORTED",
    "candidateReturned": true,
    "proposalReturned": false,
    "meaningTreeReturned": false,
    "errors": ["[ev_pickup_novel_1] OBJECT '청룡언월도' is not canonically resolvable to an inventory item."]
  }
  ```
- **관측 사실**:
  - `result.candidate`는 원본 Candidate #101 객체(`candidateId`, `label`, `narrativeSummary`, `semanticEvents`, `rawMetadata`)를 **100% 손실 없이 보존(Preserved)**하여 반환함.
  - `result.proposal` 및 `result.meaningTree`는 `undefined`로 안전하게 차단됨.

#### 4) Step 4: 실제 Caller (`server.ts`) 런타임 수명주기 추적
- **실측 파이프라인 흐름**:
  1. `translationResults = [compilationResult]` (status: `'UNSUPPORTED'`)
  2. `successfulTranslations = translationResults.filter(tr => tr.status === 'COMPILED' && Boolean(tr.proposal) && Boolean(tr.meaningTree))` → **count: 0**
  3. `candidatesToValidate` → **count: 0**
  4. `preAuthResults` (`EngineValidator.validate()`) → **count: 0**
  5. `allowedCandidates` → **count: 0**
  6. `if (allowedCandidates.length === 0)` 트리거 → **`isFallbackNonMutation: true`** 및 **`zeroMutationNarrative` 반환**
- **관측 사실**:
  - `server.ts`의 현재 번역 필터(`successfulTranslations`)는 `tr.status === 'COMPILED'`인 항목만 추출하므로, `UNSUPPORTED`인 NOVEL Candidate는 `PreAuth`(EngineValidator) 및 `SovereignEngine.commit()`으로 전송되지 않음.
  - Candidate 객체는 `forensicCapture` 및 `telemetryReport`에는 기록·보존되나, 세계 상태 변이를 일으키는 제안(Proposal)으로는 승격되지 못하고 턴이 Zero-Mutation으로 종료됨.

---

## 3. 기존 Engine-Owned NOVEL Creation Path와의 비교

### [Engine-Owned Path (`proposalParser.ts`의 `buildSafeProposalFromCandidate`)]
- `resolveCandidateInventoryIdentity`가 `NOVEL`을 반환하면, 엔진 소유 제안 생성기(`proposalParser.ts`)가 자체 권위로 `generateProposalId('item')`을 발급하고 `MODIFY_INVENTORY` (`operation: 'ADD'`, `acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'evt-armory' }`) 액션을 생성함.
- `EngineValidator.validate()` 실행 결과: **`isValid: true`** (정상 통과 및 커밋 가능).

### [Semantic Bridge Path (`runtimeSemanticCandidate.ts`)]
- `resolveInventoryItem`이 `NOVEL`을 받으면 `undefined`를 반환하고, `semanticEventToRuntimeActions`에서 `UNSUPPORTED`로 종료되어 액션을 생성하지 않음.

### [두 경로의 구조적 차이]
- **의도된 권위 분리 (Authority Separation)**:
  - Resolver는 판정만 수행하고 ID를 발급하지 않음 (`NOVEL ≠ canonical creation`).
  - Runtime Semantic Bridge는 번역 계층일 뿐 엔진의 상태 생성 권한자가 아니므로, 브리지 내에서 ID를 자의적으로 발행하지 않는 것은 P0-5 헌법에 완벽히 부합함.
- **현재 구현의 병목 지점**:
  - 현재 Semantic Bridge 계층(`semanticEventToRuntimeActions`)에는 `NOVEL` 판정된 엔티티를 Engine-Owned Proposal 생성 경로(또는 신규 엔티티 선언 액션 `ADD_ITEM` 등)로 위임하거나 전달하는 서브루틴이 없고, 즉시 `UNSUPPORTED`로 종료함.
  - 이로 인해 의미적으로 정당한 신규 아이템 습득 SemanticEvent가 제안(Proposal)으로 변환되지 못하고 차단됨.

---

## 4. 포렌식 분류 및 판정

### [FACT (실제 실행 결과)]
1. 긍정적 증거(`evt-armory`)가 구비된 신규 아이템에 대해 Resolver는 `status: 'NOVEL'`, `canonicalId: undefined`를 정확히 반환함.
2. Runtime Semantic Bridge는 조기 Canonical ID를 발급하지 않으며, `UNSUPPORTED`를 반환함.
3. `compileCandidateToProposal()`은 Candidate 객체를 온전히 보존하여 반환함 (`candidateReturned: true`).
4. `server.ts`는 `tr.status === 'COMPILED'`만 `PreAuth`로 넘기므로, `UNSUPPORTED`인 NOVEL Candidate는 `EngineValidator`/`Commit` 단계에 도달하지 못하고 Zero-Mutation Fallback으로 처리됨.
5. 반면 기존 Engine-Owned 경로(`buildSafeProposalFromCandidate`)에서는 동일한 NOVEL 아이템이 유효한 제안(`MODIFY_INVENTORY`)으로 생성되어 `EngineValidator`를 통과함 (`isValid: true`).

### [INFERENCE (논리적 도출)]
1. **경우 A vs 경우 B 분석**:
   - `compileCandidateToProposal()` 함수 레벨에서는 **경우 A** (Candidate 보존됨, 권위 경계 준수).
   - `server.ts` 통합 파이프라인 레벨에서는 **경우 B에 가까움** (Candidate가 `successfulTranslations`에서 제외되어 후속 엔진 검증/커밋 경로로 진행되지 못함).
2. 이는 P0-5 권위 경계(조기 ID 발급 차단)는 철저히 지켜졌으나, Causal Compiler / Semantic Bridge가 NOVEL 엔티티의 정당한 Engine-Owned 생성 위임 구조를 아직 갖추지 못해 발생하는 Open World 수용성 병목임.

### [UNKNOWN (실행만으로 확정할 수 없는 영역)]
1. 향후 SemanticEvent 규격에서 신규 아이템 생성을 `PICKUP` 내에서 처리할지, 아니면 별도의 의미론적 생성 이벤트(예: `DISCOVER` 또는 `ACQUIRE_NOVEL`)로 분리할지 여부.
2. Semantic Bridge가 NOVEL 엔티티를 감지했을 때 Proposal에 Engine-owned allocation 액션을 위임하는 표준 인터페이스 설계 방향.

---

## 5. P0-5 최종 판정

| 평가 항목 | 판정 | 근거 |
| :--- | :---: | :--- |
| **Authority Boundary** | **GREEN** | Resolver와 Bridge 모두 임의 Canonical ID를 발급하거나 상태를 조작하지 않음 (`NOVEL ≠ canonical creation` 100% 준수). |
| **Open World Compatibility** | **YELLOW** | 검증된 증거를 가진 신규 아이템 습득 SemanticEvent가 브리지에서 `UNSUPPORTED`로 처리되어 정식 상태 변이로 발전하지 못함. |
| **Candidate Preservation** | **GREEN** (함수 반환) / **YELLOW** (서버 승격) | `compileCandidateToProposal` 반환 시 Candidate 객체와 정보는 보존되나, `server.ts`의 `successfulTranslations` 필터링으로 인해 PreAuth/Commit으로 전송되지 않음. |

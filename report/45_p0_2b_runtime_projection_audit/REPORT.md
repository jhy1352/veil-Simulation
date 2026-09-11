# P0-2B MeaningTree -> Runtime Projection Forensic Audit Report

## 1. 개요
VEIL Causal Language V1 P0-2B Forensic Audit.
MeaningTree에서 Runtime Projection(`projectMeaningTreeToRuntimeActions`, `meaningNodeToAction`, `adaptMeaningTreeToProposal`) 및 Sovereign Engine Validator(`validator.ts`, `authoritativeEvidence.ts`)로 이어지는 경로에서 의미와 권위 정보의 보존 및 소비 상태를 정밀 추적함.

## 2. 조사 대상 및 파일
- `src/engine/language/adapter.ts` (`meaningNodeToAction`, `actionToMeaningNode`, `extractActionsAndClaimsFromMeaningTree`, `adaptMeaningTreeToProposal`)
- `src/engine/language/runtimeProjection.ts` (`projectNode`, `projectMeaningTreeToRuntimeActions`, `checkMeaningTreeProjectionConsistency`)
- `src/engine/language/types.ts` (`MeaningNode`, `SemanticEvent`, `Scope`, `Polarity`, `EpistemicStatus`, `Modality`)
- `src/engine/types.ts` (`ActionType`, `TransitionAction`, `AcquisitionEventPayload`, `SOURCE_ACTION_ACL`)
- `src/engine/validator.ts` (`EngineValidator.validate`, `SOURCE_ACTION_ACL` 검증, `MODIFY_INVENTORY` 및 `UPDATE_CHARACTER_STATS` 검증)
- `src/engine/index/authoritativeEvidence.ts` (`resolveCurrentCausalAuthority`, `findAuthoritativeEvent`)

## 3. P0-2B 최종 판정
**FAIL** (Critical Architectural & Semantic Boundary Failures)

## 4. 핵심 발견 사항 요약
1. **Compound Event Sequence Wrapper 누출 (Critical Defect)**:
   `causalCompiler.ts`가 생성하는 최상위 루트 노드 `atom: 'ACTION', value: 'COMPOUND_EVENT_SEQUENCE'`를 `runtimeProjection.ts: projectNode()`와 `adapter.ts: meaningNodeToAction()`이 일반 Action으로 오인하여 가짜 Runtime Action `{ type: 'COMPOUND_EVENT_SEQUENCE', payload: {} }`을 생성 및 주입함. 이는 `validator.ts`의 `SOURCE_ACTION_ACL` 검증에서 `UNAUTHORIZED_ACTION_FOR_SOURCE`로 즉시 거부되어 런타임 제안 전체가 파탄남.
2. **ROLE -> ENTITY 및 자식 Core Atoms 완전 누락 (Critical Semantic Loss)**:
   `adapter.ts: meaningNodeToAction()`은 오직 `node.fields`만 검사하고 `node.children`을 일체 읽지 않음. 그 결과 P0-2A에서 보존한 `ROLE(SUBJECT, RECIPIENT, OBJECT)`, `STATE`, `VALUE`, `CAUSE` 등 자식 노드가 `TransitionAction.payload`로 전혀 추출되지 못하고 소멸함.
3. **ActionType 매핑 부재**:
   자연어 컴파일러의 action 값(`'GIFT'`, `'DISCOVER'`)이 19개 표준 `ActionType`(`MODIFY_INVENTORY`, `RECORD_OFFSCREEN_EVENT` 등)으로 프로젝션되지 않고 그대로 `(node.value) as ActionType`으로 캐스팅되어 엔진의 ACL 및 유효성 검사를 통과할 수 없음.
4. **Modality(의도) 및 Polarity(부정)의 Mutation Boundary 무력화**:
   `modality: 'INTENTIONAL'`("주려고 했다") 및 `polarity: 'NEGATED'`("주지 않았다")가 `TransitionAction` 생성 시 필터링되거나 상태 변경이 차단되지 않고, 런타임 Validator/Applier 역시 이 필드를 검사하지 않아 '의도/부정'이 '실제 달성된 상태 변경 후보'로 둔갑함.
5. **Epistemic Status(HEARSAY) 및 Scope(CLAIM)의 Claim Gate 우회**:
   `atom: 'ACTION', scope: 'CLAIM', epistemicStatus: 'HEARSAY'`인 소문/전문 사건이 `rawClaims`로 분기되지 않고 `TransitionAction`으로 직접 투영되어 불신뢰 주장이 검증 없이 상태 변경 액션으로 승격됨.

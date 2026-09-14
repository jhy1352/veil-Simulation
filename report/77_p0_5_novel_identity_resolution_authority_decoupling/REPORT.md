# P0-5 Forensics & Remediation Report: NOVEL Identity Resolution & Canonical Authority Decoupling

## 1. 개요 및 변경 목적
- **과제**: P0-5 — NOVEL 조기 canonical ID 발급 경로 제거 및 권위 흐름(Authority Flow) 정상화
- **핵심 원칙**:
  - `NOVEL ≠ canonical creation`
  - `Identity resolution ≠ canonical authorization`
  - Identity Resolver의 책임은 오직 동일성 분석 및 판정(`EXACT`, `RECOVERED`, `NOVEL`, `AMBIGUOUS`, `CONFLICT`)에 한정되며, Canonical ID 발급 및 상태 변이 권한을 갖지 않는다.
  - Runtime Semantic Candidate 계층이 `NOVEL` 상태의 엔티티에 대해 임의로 `generateProposalId('item')`을 호출하여 가상/임시 ID를 발급하거나 Canonical Identity를 선점(Preempt)해서는 안 된다.

## 2. 조사 및 근본 원인 분석 (Root Cause Analysis)
- `src/engine/language/runtimeSemanticCandidate.ts`의 `createEngineSemanticBridgeContext` 내 `resolveInventoryItem` 핸들러에서, `resolveInventoryItemIdentity` 결과가 `NOVEL`일 경우 `generateProposalId('item')`을 호출하여 ID를 임의 생성하고 반환하는 경로가 존재했음.
- 이는 NPC 엔티티 해석기(`resolveCanonicalEntityId`)가 `EXACT`/`RECOVERED`가 아닐 경우 안전하게 `undefined`를 반환하는 구조와 불일치하며, 엔진의 정식 검증기(`Validator`) 및 커밋 게이트(`CommitGate`) 승인 이전에 런타임 브리지 단계에서 조기에 Canonical ID를 선점·부여하는 위반 경로였음.

## 3. 수정 내용 (Minimal Diff)
1. `src/engine/language/runtimeSemanticCandidate.ts`:
   - `createEngineSemanticBridgeContext`의 `resolveInventoryItem`에서 `resolution.status === 'NOVEL'` 분기를 제거하고, `EXACT` 또는 `RECOVERED`가 아닌 모든 경우(`NOVEL`, `AMBIGUOUS`, `CONFLICT`)에 대해 `undefined`를 반환하도록 단일화.
   - 이를 통해 정식으로 승인·등록되지 않은 `NOVEL` 아이템에 대한 SemanticEvent는 `semanticEventToRuntimeActions`에서 `UNSUPPORTED`로 Fail-Closed 처리되며, 엔진의 합의 없는 조기 ID 발급이 원천 차단됨.
2. `src/engine/language/candidateCausalPipelineTest.ts`:
   - Scenario 8을 추가하여, Canonical State 또는 History에 존재하지 않는 `NOVEL` 아이템을 조작하려는 SemanticEvent 입력 시 조기 ID 발급 없이 안전하게 `UNSUPPORTED`로 Fail-Closed되고 Candidate 객체가 보존되는지 검증.

## 4. 실행한 테스트
- `npm run test:candidate-causal-pipeline` (8/8 Scenarios PASS)
- `npm run test:candidate-gate` (54/54 Scenarios PASS)
- `npm run test:semantic-candidate-contract` (PASS)
- `npm run test:semantic-bridge-security` (PASS)
- `npm run test:semantic-runtime-projection` (PASS)
- `npm run test:composition-runtime` (PASS)
- `npm run test:integration-proof` (10/10 Proofs PASS)
- `npm run test:language` (55/55 Tests PASS)
- `npm run test:deny-derived-mutation` (PASS)
- `npm run test:engine` (93/95 Tests PASS)
- `compile_applet` (빌드 정상 완료)

# VEIL — Historical Provenance & Deterministic Replay 구현 및 전수 검증 보고서

## 1. 개요 및 목적
- **작업명**: VEIL — Historical Provenance / Authenticity 최소 Diff 구현
- **배경**: `ImmutableHistoricalRecord`에 기록된 `details` 문자열만으로는 과거 CanonicalState를 결정론적으로 재구성할 수 없어, Hydration 시 Snapshot 및 History의 위·변조를 엄밀하게 검증하지 못하던 구조적 한계를 닫음.
- **원칙**: 기존 아키텍처 재설계 배제, 최소 diff 원칙 준수, 기존 보안 방어선(Validator, ACL, Causality Firewall, Diversity Gate 등) 무결성 100% 보존.

---

## 2. 변경 파일 및 세부 구현 내용

1. **`src/engine/types.ts`**:
   - `ImmutableHistoricalRecord` 인터페이스에 `canonicalAction: TransitionAction` 필드 추가.
   - 각 상태 전이(State Transition) 발생 시 수행된 결정론적 원본 액션 페이로드를 영구 보존.

2. **`src/types.ts`**:
   - `SessionPayload` 인터페이스에 `genesisSnapshot?: CanonicalState` 필드 추가.
   - 세션 저장 시 최초 생성된 Genesis 상태 스냅샷을 앵커로 보존.

3. **`src/engine/state.ts`**:
   - `SovereignEngine`:
     - `private genesisSnapshot: CanonicalState`: 인스턴스 생성 시점의 순수 초기 상태를 캡슐화 및 보존.
     - `getGenesisSnapshot()`: Genesis 스냅샷 접근자 제공.
     - `submitProposal()`: 상태 변경 커밋 시 `ImmutableHistoricalRecord`에 `canonicalAction: deepClone(act)` 기록.
     - `SovereignEngine.hydrate()`:
       - **Stage 1**: Schema Validation (스냅샷 구조 및 통계치 검증)
       - **Stage 2**: Monotonicity Validation (상태 버전, 턴 역행 감지)
       - **Stage 3**: Hash Chain Provenance Check (`previousStateHash` 체인 무결성 검증)
       - **Stage 4**: Deterministic Replay Engine (Genesis State부터 `canonicalAction`들을 순차 적용하여 최종 스냅샷 해시와 일치 여부 검증)
       - **Fail-Closed**: 위조·누락·불일치 발견 시 `[HYDRATION_PROVENANCE_VIOLATION]` Throw 및 복원 거부.
       - **Backward Compatibility**: 레거시 기록(hash 미포함)과의 호환성 유지.

4. **`src/App.tsx`**:
   - `SessionPayload` 직렬화/역직렬화 및 로컬 스토리지 동기화 시 `genesisSnapshot` 함께 저장 및 전달.

---

## 3. 검증 결과 및 실행 증거

### A. 전용 Provenance & Replay 테스트 스위트 (`src/engine/provenanceReplayTest.ts`)
- **실행 결과**: `17/17 PASS`
- **테스트 항목**:
  1. Full Lifecycle Replay & Multi-generation Hydration
  2. Snapshot Inventory 변조 공격 방어 (Fail-Closed)
  3. Snapshot Stats 변조 공격 방어 (Fail-Closed)
  4. Snapshot NPC 변조 공격 방어 (Fail-Closed)
  5. History Action Payload 변조 공격 방어 (Fail-Closed)
  6. History Record 내 Action 누락 방어 (Fail-Closed)
  7. History Record `previousStateHash` 위조 방어 (Fail-Closed)
  8. Genesis Anchor 불일치 방어 (Fail-Closed)

### B. 기존 전수 테스트 스위트 회귀 검증
1. **`npm run test:engine`**: `93/93 PASS` (100% 정상 통과)
2. **`npm run test:language`**: `55/55 PASS` (100% 정상 통과)
3. **`npm run test:composition-runtime`**: `PASS` (100% 정상 통과)
4. **`npm run test:integration-proof`**: `10/10 PASS` (100% 정상 통과)
5. **`npm run lint` (`tsc --noEmit`)**: `0 Errors` (완전 무오류)
6. **`compile_applet`**: `Build succeeded` (빌드 정상)

---

## 4. 결론
본 변경은 기존 엔진의 어떠한 방어선도 훼손하지 않고, 상태 전이의 인과적 무결성(Causal Provenance)과 재현 가능성(Deterministic Replay)을 완전하게 닫았습니다.

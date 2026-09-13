# R1-U Unconsumed Temporal Provenance Causal Authority Remediation Report

## 1. 개요 및 배경

R1-U 취약점 분석 과정에서 발견된 핵심 쟁점:
- 과거 T0 시점에 정당하게 생성 및 승인된 Offscreen Event 또는 Narrative Seed가 시간 경과(여러 턴 및 stateVersion 증가) 후에도 소비되지 않은 상태로 유지될 때, 그 "역사적 정당성(Historical Provenance)"과 "현재 상태 전이를 유발할 수 있는 인과 권한(Current Causal Authority)" 사이의 경계가 명확히 분리되지 않았던 문제.
- 목표 불변식:
  1. Historical Canonical Provenance는 Immutable History에서 영구 보존된다.
  2. 과거 Canonical 승인 사실만으로 미래 mutation의 현재 인과 권한을 영구 부여해서는 안 된다.
  3. **단, 단순 경과시간 또는 stateVersion 차이만으로 provenance를 만료시켜서는 안 된다** (인위적 만료 시간 배제).
  4. 오직 실제 권위 있는 무효화(authoritative invalidation), 인과적 주체의 상태 변화(NPC 사망, Impostor 폭로), 명시적 취소(Revocation/Supersession), 중복 소비(Duplicate consumption) 또는 맥락 종결(Seed resolution)에 의해서만 현재 causal authority를 잃는다.

---

## 2. 변경된 아키텍처 및 최소 diff 구현

헌법적 제약에 따라 수정 범위는 엄격히 다음 2개 파일로 제한되었다:
- `src/engine/index/authoritativeEvidence.ts`
- `src/engine/validator.ts`
(`types.ts`, `passport.ts`, `offscreenHistoricalWake.ts`, `novelHistory.ts` 등 타 시스템 무수정 원칙 준수)

### 2.1 `src/engine/index/authoritativeEvidence.ts`
기존 `findAuthoritativeEvent()`의 시그니처와 역할을 100% 보존하면서, 독립적인 현재 인과 권한 판정자 `resolveCurrentCausalAuthority`를 추가:
```typescript
export interface CurrentCausalAuthorityResult {
  hasAuthority: boolean;
  found: boolean;
  eventText?: string;
  isConsumed?: boolean;
  isInvalidated?: boolean;
  isInactive?: boolean;
  isContinuityBroken?: boolean;
  rejectionReason?: string;
  conflictDetail?: string;
}

export function resolveCurrentCausalAuthority(
  verifiedEventId: string,
  state: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[]
): CurrentCausalAuthorityResult
```

판정 파이프라인:
1. **Historical Canonical/Immutable Presence 검증**: `findAuthoritativeEvent()`를 통해 과거에 실제 승인된 기록인지 확인. 미존재 시 `EVENT_NOT_FOUND`.
2. **Duplicate Consumption 방어**: `historicalRecords` 전수 조사를 통해 해당 이벤트가 이미 `MODIFY_INVENTORY` 등으로 소비되었는지 확인 (`DUPLICATE_CONSUMPTION`).
3. **Seed Inactivity / Context 검증**: Narrative Seed인 경우 활성 목록(`state.worldInfo.seeds`) 잔존 여부 및 해결 이력 확인 (`SEED_RESOLVED_IN_HISTORY` / `SEED_INACTIVE`).
4. **Offscreen Status 무효화 검증**: `matchingOffscreen.status`가 `INVALIDATED`, `REVOKED`, `SUPERSEDED` 등인 경우 차단.
5. **Causal Agent Continuity 검증**:
   - 이벤트에 연관된 NPC(`involvedNpcIds`)의 현재 상태 확인.
   - NPC가 `DEAD` 상태인 경우: 사망 이전에 획득되지 않고 사후에 생성/수여하는 모순 방지 (`SOURCE_NPC_DEAD`).
   - NPC가 `IMPOSTOR`, `FRAUD` 등으로 밝혀진 경우: 사기/위장 주체에 의한 권한 차단 (`SOURCE_NPC_IMPOSTOR`).
6. **Explicit Historical Revocation / Invalidation 검증**:
   - 역사 기록 내에서 해당 이벤트를 대상으로 발생한 무효화 사건(`FORGERY_DISCOVERED`, `CANON_IDENTITY_INVALIDATION`, `SUPERSEDED` 등) 전수 추적 (`EVENT_REVOKED_IN_HISTORY`, `EVENT_INVALIDATED_IN_DETAILS`).
7. **Normal Continuity 보존**:
   - 위 무효화 사유가 존재하지 않는 한, 단순 시간/stateVersion 차이만으로는 권한을 박탈하지 않고 정상 승인 (`hasAuthority: true`).

### 2.2 `src/engine/validator.ts`
`MODIFY_INVENTORY`의 `ADD` 검증 블록에서 `resolveCurrentCausalAuthority`를 호출:
- `acquisition.cause`가 이벤트 접지를 요구하는 경우(`DISCOVERY_PICKUP`, `GIFT_REWARD`, `LOOT` 등), 과거 존재성뿐만 아니라 **현재 유효한 인과 권한(`causalAuth.hasAuthority`)**을 검증.
- 권한이 상실된 경우, 명확한 `conflictDetail`과 함께 `FAIL-CLOSED` 거부(`STATE_CONFLICT` / `INVALID_ACTION`).

---

## 3. 회귀 테스트 스위트 (`causalAuthorityRegressionTest.ts`)

총 6개의 시나리오를 설계하여 모든 경계 조건을 검증:

1. **Case 1: Normal Temporal Continuity with Unconsumed Provenance**
   - T0에 정당한 오프스크린 보관함 이벤트 생성 (소비하지 않음).
   - 5턴 동안 시간 전진 (`ADVANCE_TIME`, 턴 6, stateVersion 대폭 증가).
   - 턴 6에서 해당 이벤트를 근거로 아이템 획득 시도.
   - **결과**: 인위적 시간/버전 만료 없이 정상 승인 확인 (`PASS`).

2. **Case 2: Source NPC Died Prior to Item Claim**
   - 대장장이 NPC가 도끼를 완성한 오프스크린 이벤트 발생.
   - 이후 대장장이 NPC가 전투 중 사망 (`SET_NPC_STATUS: DEAD`).
   - 사후에 대장장이로부터 아이템을 수여받으려는 시도.
   - **결과**: `SOURCE_NPC_DEAD`로 즉시 거부 및 상태 오염 방지 확인 (`PASS`).

3. **Case 3: Source NPC Unmasked as Impostor**
   - 특사가 황실 마패를 하사하는 이벤트 발생.
   - 이후 해당 특사가 가짜/사칭자임이 밝혀짐 (`role: 'IMPOSTOR'`).
   - 위조된 권위에 기반한 마패 획득 시도.
   - **결과**: `SOURCE_NPC_IMPOSTOR`로 즉시 거부 확인 (`PASS`).

4. **Case 4: Event Explicitly Revoked in History**
   - 밀수품 보물 상자 발견 이벤트 발생.
   - 이후 수사관들에 의해 해당 물품이 위조품으로 판명/압수됨 (`FORGERY_DISCOVERED`).
   - 무효화된 과거 이벤트를 재활용하여 아이템을 취득하려는 시도.
   - **결과**: `EVENT_REVOKED_IN_HISTORY` / `EVENT_INVALIDATED_IN_DETAILS`로 거부 확인 (`PASS`).

5. **Case 5: Duplicate Consumption Invariant Maintained**
   - 영약 발견 이벤트 발생 -> 1차 획득 성공 (소비됨).
   - 동일 이벤트 ID로 2차 획득 시도.
   - **결과**: `DUPLICATE_CONSUMPTION`으로 거부 확인 (`PASS`).

6. **Case 6: Preserved Inactive Context Error Invariant**
   - 서사 씨앗 생성 -> 정상 해결 (`RESOLVE_NARRATIVE_SEED`).
   - 해결된 씨앗 ID를 근거로 아이템 생성 시도.
   - **결과**: `SEED_RESOLVED_IN_HISTORY`로 거부 확인 (`PASS`).

---

## 4. 검증 결과

- `npm run test:causal-authority`: 6/6 Cases All Passed.
- `npm run test:engine`: 95/95 Tests All Passed.
- `npm run test:language`: 55/55 Tests All Passed.
- `npm run test:provenance`: 28/28 Tests All Passed.
- `npm run test:causal-provenance`: All Passed.
- `npm run test:novel-lifecycle`: 140/140 Tests All Passed.
- `npm run lint` (`tsc --noEmit`): 0 errors, Clean.
- `compile_applet`: Build succeeded.

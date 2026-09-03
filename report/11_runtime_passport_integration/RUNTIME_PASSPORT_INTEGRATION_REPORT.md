# Runtime Passport Integration & Forensic Verification Report

**Report Number**: 11  
**Category**: Runtime Integration & Forensic Verification  
**Module**: Identity Continuity — Runtime Passport Integration  
**Date**: 2026-09-03  
**Target Branch**: `work/identity-continuity`  
**Commit Reference**: `3335819`  

---

## 1. 개요 및 목적

본 보고서는 TRPG 3.1 시스템 헌법(제2조, 제3조, 제4조, 제5조, 제52조, 제53조, 제55조, 제56조, 제87조)에 의거하여, Identity Continuity의 프로젝션 계층인 **Identity Passport** 시스템을 SovereignEngine의 실제 런타임 라이프사이클에 최소 침습(minimal surgical modification)으로 연결하고 정합성을 전수 검증한 결과를 기록한다.

### 헌법상 권한 계층 및 불변 원칙
```
ImmutableHistoricalRecord / History
        ↓
CanonicalState
        ↓
IdentityResolver
        ↓
NovelHistory
        ↓
Passport (Derived Projection)
```
- **History가 원본이다**: Passport는 어떠한 상태도 자체적으로 확정하지 않으며, ImmutableHistoricalRecord와 CanonicalState, NovelHistory로부터 100% 결정론적으로 도출(projected)되는 파생 상태(derived state)다.
- **Identity Authority 추가 금지**: `projectPassports()` 자체의 시그니처나 로직을 변경하지 않고, 런타임 상태 커밋 및 복원 지점에 순수하게 연결한다.
- **무결성 및 지속성 보장**: 브라우저 재시작, 세션 저장/불러오기(Save/Load), Rejected Turn에서도 Passport 파생 상태가 유실되거나 거짓(forged) 상태로 전이되지 않는다.

---

## 2. 수정된 파일 및 구체적 변경 내역

### 1) `src/engine/index/passportTest.ts`
- **수정 사유**: Test Suite 5 ("Complex Lineage & Demotion Tracking")의 마지막 검증에서, 전체 여권 풀(`passports.passports`) 중 `passportVersion`이 1~4인 모든 엔티티를 카운트하는 필터 조건 오류로 인해 기준 엔티티(`novel.novelId` 및 `npc-doctor`) 외의 다른 엔티티(주인공 등)가 포함되어 카운트 불일치가 발생하던 결함 수정.
- **수정 내용**:
  ```typescript
  // Before:
  assert(passports.passports.filter(p => p.passportVersion === 1 || p.passportVersion === 2 || p.passportVersion === 3 || p.passportVersion === 4).length === 4, 'No duplicate Passport node is created for the same transition');

  // After:
  assert(passports.passports.filter(p => (p.entityId === novel.novelId || p.entityId === 'npc-doctor') && (p.passportVersion === 1 || p.passportVersion === 2 || p.passportVersion === 3 || p.passportVersion === 4)).length === 4, 'No duplicate Passport node is created for the same transition');
  ```

### 2) `src/App.tsx`
- **수정 사유**: `SovereignEngine`의 실 런타임에서 사용자 플레이 시 `submitProposal()` 성공, 창작 완료, 세션 로드 시점에 `passports` 필드가 deterministic하게 갱신 및 유지되도록 연결.
- **수정 지점 4개소**:
  1. **창작 완료 경로 (`handleCompleteCreation`)**:
     - `genesisEngine` 생성 직후 `projectPassports(genesisEngine.getSnapshot(), [], [])`를 실행하여 초기 상태의 Baseline Passport(주인공, 초기 세력/NPC 등)를 투영하고 `setEngineState`에 저장.
  2. **사용자 행동 커밋 성공 경로 (`handleSendMessage`)**:
     - `engine.submitProposal(proposal)` 성공 및 `observeCandidateNovelHistory()` 관찰 직후:
       ```typescript
       const derivedPassports = projectPassports(
         commitResult.snapshot,
         engine.getHistory(),
         observationResult.updatedRecords
       );
       nextEngineState.passports = derivedPassports;
       ```
     - 턴이 거부(rejected)되거나 변경사항이 없는 경우(`EMPTY_PROPOSAL_REJECTED` 등) 기존 `engineState.passports`가 얕은 복사를 통해 안전하게 보존됨.
  3. **세션 수화 경로 (`handleLoadSession`)**:
     - `hydratedEngine` 복원 후, 스냅샷과 히스토리, `novelHistoryRecords`로부터 즉시 `projectPassports(snap, hist, novelRecs)`를 호출하여 파생 상태를 온전히 재투영.
  4. **마운트 시 로컬스토리지 복원 경로 (`useEffect`)**:
     - 세션 로드와 동일하게 권위 있는 엔진 인스턴스 스냅샷/히스토리로부터 Passport를 결정론적으로 재구성하여 일관성 보장.

---

## 3. 실제 런타임 호출 경로 분석

| 런타임 이벤트 | 호출 함수 / 트리거 | 동작 및 Passport 처리 | 상태 정합성 보장 메커니즘 |
|---|---|---|---|
| **Genesis State 생성** | `handleCompleteCreation()` | `genesisEngine.getSnapshot()` 기반으로 `projectPassports()` 호출 | 초기 주인공 및 세계관 엔티티의 `CANON` 도메인 v1 Passport 발급 |
| **User Action Commit 성공** | `handleSendMessage()` → `submitProposal()` 성공 | `commitResult.snapshot`, `engine.getHistory()`, `observationResult.updatedRecords`를 넘겨 `projectPassports()` 호출 | 신규 아이템/NPC/세력은 `NOVEL` 또는 `CANON` 여권 발행, 제거/사망 엔티티는 `RETIRED` 상태로 전이 |
| **User Action Rejected / Stale** | `handleSendMessage()` → `submitProposal()` 실패 | 상태 전이가 거부되므로 `nextEngineState.passports`는 기존 상태 유지 | 헌법 제15조 원자성 보장, 중간 비정상 상태나 거짓 여권 발생 방지 |
| **Session Load / Re-hydration** | `handleLoadSession()` & Mount `useEffect` | `hydratedEngine`의 authoritative snapshot + history + `novelHistoryRecords`로 `projectPassports()` 즉각 재도출 | 헌법 제53조 및 제54조 준수: 외부 저장된 파생 상태를 맹신하지 않고 권위 데이터로부터 결정론적 복원 |

---

## 4. 검증 결과 및 실행 증거

### 1) Test Suite 검증
- **`npm run test:passport`**:
  ```text
  Test Suite 1: Canonical Baseline Projection Passed (10/10)
  Test Suite 2: Novel Lifecycle Integration Passed (8/8)
  Test Suite 3: Promotion from Novel to Canon Passed (6/6)
  Test Suite 4: Demotion from Canon to Novel Passed (6/6)
  Test Suite 5: Complex Lineage & Demotion Tracking Passed (6/6)
  Test Suite 6: Immutability & Forensic Stamp Invariant Tests Passed (6/6)
  Total: 42/42 tests passed.
  ```
- **`npm run test:identity-continuity`**:
  ```text
  Total: 92/92 tests passed across 12 test suites.
  (All Recovery Gate, Red Team Forgery, Lineage, Promotion, Demotion tests passed)
  ```

### 2) 정적 타입 및 린트 검증 (`npm run lint`)
- `tsc --noEmit`: 오류 없이 종료 코드 0 완료 (Clean).

### 3) 프로덕션 빌드 검증 (`npm run build`)
- Vite v6.4.3 클라이언트 빌드: 2,126 모듈 번들링 완료 (0 오류).
- Esbuild 서버 번들링: `dist/server.cjs` 생성 완료 (38ms, 0 오류).
- `compile_applet` 도구 검증: `Build succeeded - the applet is compiled`.

### 4) End-to-End 실 런타임 커밋 파이프라인 시뮬레이션
- 실제 `SovereignEngine.submitProposal()` 성공 및 `observeCandidateNovelHistory()` 관찰 후 `projectPassports()`를 호출하는 실 런타임 동일 환경 검증:
  - 소모된 '철검': `passport:canon:item-iron-sword:v1` → `RETIRED` 상태 전이 확인.
  - 새로 획득한 '벽력탄': `passport:novel:nov-item-벽력탄:v1` → `NOVEL` 도메인 `ACTIVE` 여권 발행 확인.
  - 기존 '방장 스님' 및 '소림사': `CANON` 도메인 `ACTIVE` 상태 보존 확인.

---

## 5. 미실행 항목

- **없음**: 요청된 모든 검증 항목(테스트 스위트 2종, 린트, 빌드, 실 런타임 커밋 파이프라인 시뮬레이션, Git 반영)을 전수 실행 완료함.

---

## 6. Git Commit 및 원격 저장소 동기화 기록

- **로컬 커밋**: `3335819` (`feat(identity): wire Identity Passport projection to SovereignEngine runtime`)
- **원격 푸시**: `git push origin work/identity-continuity` 완료 (`e4fe979..3335819`)
- **수정 파일**:
  - `src/App.tsx` (+38, -3)
  - `src/engine/index/passportTest.ts` (+1, -1)
  - `report/11_runtime_passport_integration/RUNTIME_PASSPORT_INTEGRATION_REPORT.md` (신규 포렌식 보고서 보존)

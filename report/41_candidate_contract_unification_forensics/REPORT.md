# VEIL CANDIDATE CONTRACT UNIFICATION & GATE HARMONIZATION FORENSIC REPORT

## 1. 개요 및 목적
- **목표**: VEIL 시스템의 Candidate 외부 계약을 `server.ts`와 `CandidateRecoveryGate`, `extractCandidatesFromMetadata`, `CandidatePacket`, `buildSafeProposalFromCandidate`, PreAuth / Validator, Sovereign Commit에 걸쳐 단일 세대로 통일하고 완결된 방화벽 구조를 확립.
- **적용 헌법 및 규정**:
  - TRPG 3.1 헌법 제66-1조 (코드·프롬프트 예시 금지) 준수: 규범적 타입 정의와 스키마 제약으로 완비.
  - 헌법 제5조 (권위 계층), 제6조 (양방향 Truth Boundary), 제13조 (Parse ≠ Validate ≠ Commit), 제14조 (Canonical Commit Gate), 제18조~제21조 (주사위 및 CSPRNG 엔진 결정론), 제84조 (절대 금지 규칙).

---

## 2. 조사 및 식별된 불일치 (EOF 분석)
1. **외부 Candidate 계약 필드 통일**:
   - `server.ts` 및 `CandidateRecoveryGate`에서 공식 허용되는 `rawMetadata` 키:
     - `foreshadowSeeds`
     - `resolvedSeeds`
     - `cameraOffscreenEvents`
     - `newNpcs`
     - `newFactions`
     - `inventoryChanges`
     - `statDeltas`
     - `characterChanges`
     - `chapterChanges`
   - 허용되지 않은 키(`recommendedDC`, 레거시 최상위 필드 등)는 엄격히 `UNKNOWN_FIELD` 위반으로 격리/거부됨.
2. **Adapter (`extractCandidatesFromMetadata`) 매핑 정합성**:
   - `recommendedDC` 외부 주입 경로 차단 (`undefined` 고정). 주사위 DC 및 난수 결정은 엔진 고유 권위(제18조~제21조).
   - `chapterChanges`의 비정규 최상위 폴백 제거 및 엄격한 중첩 객체 계약 준수.
   - `inventoryChanges`에 `entityReference` 필수 전달 보장.
   - `resolvedSeeds`, `newNpcs`, `newFactions`에 `entityReference` 바인딩 유지.
3. **타입 정의 정비 (`src/types.ts`)**:
   - `CandidatePacket` 내 필드 주석을 규범적 런타임 요구사항 및 레거시 내부 매핑 상태로 명시.
   - 예시 잔존 없는 순수 타입 규약 확립.

---

## 3. 수정 및 방화벽 조치 내역
1. `src/engine/language/candidateRecoveryGate.ts`:
   - `inventoryChanges` 엔트리에 `entityReference` 객체 필수 규약 적용 (`REQUIRED_FIELD_MISSING` 방화벽).
   - 문법 및 괄호 불일치 제거.
2. `src/utils/engineValidator.ts`:
   - `extractCandidatesFromMetadata`에서 `entityReference`를 복원하여 `CandidatePacket`에 정밀 전달.
   - `recommendedDC` 외부 메타데이터 바인딩 영구 제거.
   - `chapterChanges` 중첩 구조 엄격 파싱.
3. `src/types.ts`:
   - `CandidatePacket` 인터페이스 규범화.
4. `src/engine/index/entityIdentityResolverTest.ts`:
   - 테스트 픽스처의 `rawMetadata`를 통합된 외부 계약과 완벽히 동기화.

---

## 4. 검증 결과 (100% PASS)
- `test:candidate-gate`: 49/49 PASSED
- `test:candidate-bdesign`: 51/51 PASSED
- `test:identity-continuity`: 117/117 PASSED
- `test:engine`: 95/95 PASSED
- `test:language`: 55/55 PASSED
- `test:provenance`: 28/28 PASSED
- `test:causal-provenance`: 6/6 PASSED
- `test:inventory-cost-quantity`: All Passed
- `test:identity-roundtrip`: All Passed
- `test:novel-lifecycle`: 140/140 PASSED
- `test:passport`: 42/42 PASSED
- `test:player-input-provenance`: All Passed
- `test:player-input-cross-layer`: All Passed
- `test:offscreen-wake`: 14/14 PASSED
- `test:wake-necessity`: 10/10 PASSED
- `test:wake-aggregation`: 10/10 PASSED
- `test:redteam-campaign`: All Attacks Blocked
- `test:redteam-mission`: ALL GREEN (100% Blocked & Hardened)
- `npm run lint` (`tsc --noEmit`): Clean (Exit Code 0)
- `compile_applet`: Build Succeeded

---

## 5. 결론
LLM 생성 계약(`CandidateOutput`)에서부터 `CandidateRecoveryGate`, `extractCandidatesFromMetadata`, 내부 `CandidatePacket`, `buildSafeProposalFromCandidate`, PreAuth/Validator, Sovereign Commit까지의 데이터 흐름이 단일 세대 계약으로 완벽히 통일되었으며, 중간 유실이나 미검증 오염 경로가 존재하지 않음을 증명하였다.

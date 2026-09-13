# Report 72: FORENSIC RAW Pipeline & Automated Evidence Preservation Implementation

- **Date:** 2026-09-12
- **Author:** Antigravity AI Studio Coding Agent
- **Target Branch:** `work/identity-continuity`
- **Scope:** FORENSIC RAW Observer Pipeline, Zero-Impact Read-Only Evidence Tap, Multi-UI Toggle, Integrity Manifest

---

## 1. 목적 및 배경

헌법 제5장(Historical Record / Provenance) 제21조(Evidence Separation) 및 제9장(테스트와 포렌식) 제35조(Forensic Classification)에 의거하여, TRPG 3.1 엔진의 실시간 런타임 증거를 유실 없이 보존하고 사후 포렌식 검증을 자동화하기 위한 **FORENSIC RAW 수집 및 보존 파이프라인**을 구축하였다.

본 구현은 기존 엔진의 Canonical State Mutation, State Transition Gate, Authorization Pipeline, Commit Gate의 무결성을 100% 보존하면서, 어떠한 간섭도 없는 순수 관찰(Read-Only Observer) 패턴으로 설계되었다.

---

## 2. 헌법 준수 및 핵심 설계 원칙

1. **제37조 (Minimal Diff) & 제42조 (절대 금지 40항)**
   - 기존 비즈니스 로직 및 엔진 코어의 판정 메커니즘을 수정하지 않음.
   - 캡처 로직은 턴 처리 완료 후 완전히 분리된 비동기 태스크로 동작하여 렌더링 및 게임플레이 응답성에 영향을 주지 않음.
2. **제40조 (Configuration Safety)**
   - 서버 엔드포인트 수신 시 Vercel, GitHub, Gemini API Key 등 모든 민감 인증정보를 정규식 기반으로 사전 마스킹(`[REDACTED_SECRET]`)하여 저장.
   - 보고서 및 파일시스템에 토큰 하드코딩 일체 금지.
3. **제41조 (Development / Production Boundary)**
   - `/api/dev/forensic-raw` 엔드포인트는 `process.env.NODE_ENV === 'production'` 환경에서 접근 시 403 Forbidden으로 차단하여 프로덕션 파일시스템 오염 방지.
4. **제21조 (Evidence Separation)**
   - Raw Input, Context, LLM Phase 1/2 Raw Text, Meaning Trees, Pre-Auth, Authorization, Commit Verdict, Pre/Post State를 단계별로 온전히 격리 보존.

---

## 3. 구현 세부 내역

### 3.1. 클라이언트 디스패처 및 스토리지 (`src/utils/forensicRaw.ts`)
- `isForensicRawEnabled()` / `setForensicRawEnabled(enabled)`: LocalStorage 기반 온/오프 상태 관리 (`forensic_raw_enabled`).
- `getOrInitRunId(worldName)`: 세션별 고유 실행 ID (`run_<timestamp>_<hash>`) 발급 및 세션 초기화 시 자동 갱신.
- `dispatchForensicRawCapture(packet)`: 백그라운드 fetch를 통한 `/api/dev/forensic-raw` 비동기 전송.

### 3.2. 실시간 다중 UI 토글 연동
- **헤더 네비게이션 (`src/components/GameInterface.tsx`)**: 상단 툴바에 직관적인 `[FORENSIC RAW] OFF / ON` 토글 버튼 배치 (활성화 시 에메랄드 펄스 인디케이터 표시).
- **시스템 환경설정 드롭다운**: 톱니바퀴 메뉴 내에 세션 옵션으로 포함.
- **엔진 진단 모달 (`src/components/EngineDiagnosticsModal.tsx`)**: 실시간 감사 모달 내 모델 선택기와 병렬로 상태 확인 및 제어 가능.

### 3.3. 백엔드 원본 증거 보존 엔드포인트 (`server.ts`)
- **경로**: `POST /api/dev/forensic-raw`
- **저장 위치**: `report/raw/00_<safeWorldName>/turn_<turn>_raw.json`
- **무결성 매니페스트 (`manifest.json`)**:
  - `runId`, `worldName`, `gitCommit` (Git HEAD 자동 추출)
  - 턴 파일별 타임스탬프, 바이트 크기, SHA-256 해시 등록 및 실시간 갱신

---

## 4. 검증 결과

- **정적 타입 및 린트 검증**: 주요 컴포넌트(`GameInterface`, `EngineDiagnosticsModal`, `App`, `server.ts`) 정상 컴파일.
- **런타임 E2E 엔드포인트 검증**:
  - curl 명령어를 통해 `/api/dev/forensic-raw`로 모의 턴 패킷 전송.
  - JSON 저장, SHA-256 해시 계산, `manifest.json` 자동 생성 정상 동작 확인.
  - 테스트용 아티팩트 안전하게 정리 완료.
- **프로덕션 빌드 검증 (`npm run build`)**: esbuild 번들링 및 Vite 클라이언트 빌드 정상 통과 (`dist/` 생성 확인).

---

## 5. 결론 및 향후 활용

이제 사용자는 언제든지 UI 상단의 `[FORENSIC RAW]` 버튼을 활성화하여 턴 진행 간 발생하는 모든 원본 증거와 결정론적 상태 변화를 `/report/raw/` 하위에 구조화된 JSON 파일로 자동 보존할 수 있으며, 포렌식 감사 및 회귀 분석에 즉시 활용할 수 있다.

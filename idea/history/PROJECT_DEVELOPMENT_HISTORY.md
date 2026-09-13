# TRPG 3.1 — 프로젝트 개발 연혁 (Project Development History)

본 문서는 TRPG 3.1 Sovereign Engine의 개발 단계, 저장소 계보, 주요 Git 커밋 및 감사 마일스톤을 시간순으로 정리한 공식 연혁 기록이다. 본 문서는 현재 저장소에 보존된 실제 Git 히스토리, 보고서 파일, 감사 로그 및 공식 인계 자료만을 기반으로 작성되었으며, 확인되지 않은 과거 내역은 `[NOT VERIFIED]`로 명시한다.

---

## 1. 프로젝트 계보 및 배경 (Repository Lineage & Ancestry)

- **공식 GitHub 조직/사용자 주소**: `https://github.com/jhy1352/`
- **프로젝트 진화 계보**:
  1. **Sajo**: 최초 독립 프로젝트 (현재 3.1 작업과 분리된 초기 단계 작업).
  2. **all trpg**: 후속 기능 확장 및 종합 TRPG 엔진 개발 라인.
  3. **3.1back**: `all trpg` 대규모 업데이트 중 발생한 오류 및 복잡성을 해소하기 위해 보다 원시적이고 견고한 구조로 복원하여 새로 시작한 저장소이자 현재 TRPG 3.1 Sovereign Engine의 직접적 시원(Root Ancestor).

---

## 2. 주요 개발 단계 및 마일스톤 (Development Phases & Milestones)

### Phase 0 ~ Phase 2: 초기 아키텍처 및 원시 런타임 정립 [NOT VERIFIED in detail - historical background]
- **배경**: `3.1back` 기반에서 LLM에 종속되지 않는 엔진 주권(Engine Sovereignty) 기초 아키텍처 수립.
- **핵심 목표**: LLM이 세계 상태를 임의로 조작하지 못하도록 상태와 서사를 분리하는 뼈대 구축.

### Phase 2.9: 베이스라인 엔진 무결성 및 증거 매니페스트 수립
- **관련 파일**:
  - `audit/PHASE_2_9_REPORT.md`
  - `audit/PHASE_2_9_EVIDENCE_MANIFEST.json`
  - `audit/PHASE_2_9_EXECUTION_LOG.txt`
  - `audit/PHASE_2_9_FILE_HASHES.txt`
- **주요 내용**: 파일별 SHA 해시 검증, 실행 로그 캡처 및 결정론적 상태 프로젝션 무결성 검증 체계 확립.

### Phase 5.6: 서사 엔진 감사 및 차세대 단계 포렌식 (Audit of Audit & Next Step Forensics)
- **관련 파일**:
  - `idea/report/phase5_6_audit_of_audit_raw_report_part_1.md` ~ `part_5.md`
  - `idea/report/phase5_6_next_step_raw_report_part_1.md` ~ `part_16.md`
  - `idea/phase5_6_raw_evidence_completion.txt`
  - `phase5_6_raw_evidence_log.txt`
- **주요 내용**: 16단계 연속 실행 로그 분석, 헌법 준수 감사 및 상태 전이 인과 검증.

### Phase 5.7: 런타임 경계, Gap 해소 및 최종 성공 증거 감사
- **관련 파일**:
  - `idea/report/phase5_7_runtime_boundary_audit_raw_report_part_1.md` ~ `part_2.md`
  - `idea/report/phase5_7_final_success_audit_report.md`
  - `idea/report/phase5_7_final_runtime_report.md`
  - `scripts/phase5_7_product_runtime_integration_suite.ts`
  - `scripts/phase5_7_boundary_forensic_suite.ts`
- **주요 내용**:
  - `SOURCE_ACTION_ACL` (Player/LLM 권한 격리 관문) 검증.
  - `Causality Gate` (단서/인과 없는 자의적 아이템 획득 및 상태 승격 차단) 검증.
  - Deep Object Equality를 통한 스냅샷 영속성 직렬화/복원 검증.

### Phase TRPG 3.8: 포스트-5.7 종합 감사 러너 구축
- **관련 파일 및 커밋**:
  - `scripts/trpg3_8_post5_7_comprehensive_audit_runner.ts`
  - `idea/report/trpg3_8_audit_part1.txt`
  - Git Commit: `56c86a948afcf60b6a6a02b8313bf800d6e20fe2`
- **주요 내용**: 18개 종합 테스트 케이스(공격 방어 4종, 정상 플레이 11종, 정보 경계 3종) 프레임워크 작성 및 실행.

### Phase TRPG 3.8-R: 엄격 재감사 및 취약점 보고 (Strict Re-Audit)
- **관련 파일 및 커밋**:
  - `idea/report/trpg3_8_reaudit_report.md`
  - `idea/report/trpg3_8_reaudit_raw_evidence.txt`
  - Git Commit: `ee30da8d287523a7862eb723fb6d159add6ae1bb`
- **주요 내용**:
  - 18개 테스트 중 17개 PASS, 1개 실제 취약점(`INFO-B`) 발견 및 투명 보고.
  - `server.ts` (lines 466-470) 오프스크린 사건 프롬프트 생성 시 `visibility: 'HIDDEN'` 필터링 누락 결함 식별.
  - Truthfulness Directive에 따라 자가 승인이나 Mocking 없이 결함 팩트를 보고서에 그대로 명시.

### Constitutional Principle Insertion (엔진 주권 / 서사 보존 원칙 정립)
- **관련 파일 및 커밋**:
  - `idea/Engineer/sovereign_engine_constitution.md` (제1장 말미 삽입)
  - `idea/Engineer/llm_engine_interaction_protocol.md` (제1절 말미 삽입)
  - Git Commit: `d8ef01c2fb3f56738cebe916c3801a85cdecda27`
- **주요 내용**: Zero-Diff/Minimal-Diff 원칙 하에 기존 조항 100% 보존하면서 `[ENGINE SOVEREIGNTY & NARRATIVE FREEDOM]` 및 `[LLM / ENGINE RESPONSIBILITY BOUNDARY]` 명문화.

---

## 3. Git Commit 공식 인덱스 (Verified Git History)

| Commit SHA (Full / Short) | Date (UTC) | Author | Commit Message | 핵심 변경 내역 |
|---|---|---|---|---|
| `56f4a0df5a23a8590c9c551c90b1582b51114825`<br>(`56f4a0d`) | 2026-08-24 13:26:56 | AI Studio Agent | `chore: baseline codebase for TRPG 3.8 audit` | TRPG 3.8 베이스라인 전체 코드베이스 및 이전 Phase 리포트 일괄 적재 (119 files) |
| `56c86a948afcf60b6a6a02b8313bf800d6e20fe2`<br>(`56c86a9`) | 2026-08-24 14:11:34 | AI Studio Agent | `feat(audit): add TRPG 3.8 post-5.7 comprehensive audit runner and raw evidence logs` | 18개 종합 감사 러너 스크립트 및 1차 감사 로그 추가 (3 files) |
| `5c5d127b3e1bb4801128eeff6a242c16198f1228`<br>(`5c5d127`) | 2026-08-24 14:13:00 | AI Studio Agent | `docs(report): update all reports and evidence files` | Phase 5.7 및 TRPG 3.8 보고서/증거 파일 정합성 업데이트 (5 files) |
| `ee30da8d287523a7862eb723fb6d159add6ae1bb`<br>(`ee30da8`) | 2026-08-24 14:33:06 | AI Studio Agent | `feat(audit): TRPG 3.8-R post-5.7 comprehensive re-audit report and raw evidence` | 엄격 재감사 실행 결과(17 PASS, 1 FAIL) 및 RAW 로그 저장 (3 files) |
| `d8ef01c2fb3f56738cebe916c3801a85cdecda27`<br>(`d8ef01c`) | 2026-08-24 15:31:00 | AI Studio Agent | `docs(constitution): record Engine Sovereignty, Narrative Freedom, and Information Asymmetry principles` | 헌법 및 프로토콜 문서에 엔진 주권 및 서사 자유 원칙 최소 삽입 (2 files) |

---

## 4. 현행 문서 및 코드베이스 매핑 요약

- **헌법 및 프로토콜**:
  - `idea/Engineer/sovereign_engine_constitution.md` (TRPG 3.1 시스템 헌법 제1조~제70조)
  - `idea/Engineer/llm_engine_interaction_protocol.md` (LLM↔Engine 상호작용 규약)
  - `idea/Engineer/AUDITOR_TRUST_PROTOCOL.md` (감사관 신뢰 및 검증 규약)
  - `idea/advisor_handoff.md` (참모 인계 및 최상위 아키텍처 원칙)
- **엔진 코어 (`src/engine/`)**:
  - `validator.ts` / `utils/engineValidator.ts`: 상태 전이 제안 유효성 검증
  - `state.ts`: Canonical State 및 Snapshot 관리
  - `actionApplier.ts`: Draft State 액션 적용
  - `history.ts`: Historical Record 불변 기록
  - `index/indexer.ts`, `retriever.ts`, `knowledgeGraph.ts`: 정보 경계 및 장기 기억 인덱싱

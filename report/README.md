# TRPG 3.1 Forensic Evidence Repository

이 디렉터리는 **TRPG 3.1 시스템 헌법 및 포렌식 엔지니어링 지침(제90조~제96조)**에 따라 수행된 모든 레드팀 공격, 침투 감사 및 검증 과정의 **불변 Raw 증거물(Immutable Raw Evidence)**과 **상세 분석 보고서**를 보관합니다.

---

## 🔒 절대 원칙 (Absolute Preservation Policy)

1. **불변 증거 보존 (Immutable Evidence)**:
   - Raw 결과값은 절대 덮어쓰거나 수정하지 않습니다.
   - 패치된 결과를 과거 파일에 덮어쓰지 않고, 새로운 공격/감사 수행 시 반드시 하위 폴더를 신규 생성하여 보관합니다.
2. **독립 폴더 격리 (Isolated Attack Runs)**:
   - 각 공격 라운드 및 침투 시나리오마다 독립적인 하위 디렉터리를 구성하여 증거를 불변 상태로 격리합니다.
3. **원격 저장소 동기화 (Git Provenance Traceability)**:
   - 모든 증거물과 보고서는 Git 원격 저장소(`origin/veil`)에 즉시 커밋 및 푸시하여 이력을 보존합니다.

---

## 📂 공격 순서별 증거 보관 디렉터리 구조

| 디렉터리 | 공격/감사 단계 | 주요 포함 파일 | 설명 |
|---|---|---|---|
| `01_initial_runtime_breach/` | 1차 런타임 침투 및 9개 표면 공격 | `red_team_breach_raw_evidence.txt`<br>`red_team_runtime_breach_raw_evidence.txt`<br>`final_red_team_adversarial_proof.txt`<br>`adversarial_runtime_break_raw_evidence.txt` | 초기 9대 공격 표면 대상 적대적 런타임 브레이크 탐지 및 VEC-01~05 발견 기록 |
| `02_confirmed_breaks_reproduction/` | 확인된 브레이크 독립 재현 및 전파 감사 | `confirmed_breaks_independent_verification.txt`<br>`confirmed_break_forensic_reattack_report.txt`<br>`confirmed_break_propagation_report.txt` | VEC-01~05에 대한 독립적 재현 스크립트 실행 증거 및 전파 변종 탐색 보고서 |
| `03_evidence_integrity_reverification/` | 증거 무결성 재검증 감사 | `evidence_integrity_reverification_report.txt` | 초기 브레이크 발견 당시의 원본 증거 무결성 및 인과성 재검증 감사 기록 |
| `04_invariant_propagation_redteam/` | 마스터 인베리언트 전파 및 14개 표면 심층 공격 | `final_invariant_propagation_raw_evidence.json`<br>`final_invariant_propagation_report.txt`<br>`FINAL_INVARIANT_PROPAGATION_FORENSIC_REPORT.txt` | 14개 침투 벡터 대상 인베리언트 방어 전파 검증 및 Zero-Mutation 입증 기록 |
| `05_forensic_residue_trust_boundary/` | VEIL 포렌식 잔재/디버그 시스템 신뢰경계 침투 감사 | `forensic_residue_redteam_raw_evidence.json`<br>`FORENSIC_RESIDUE_TRUST_BOUNDARY_REPORT.txt` | upload6→VEIL 잔재, 텔레메트리, 프로토타입 오염, 세션 재수화 등 16개 벡터 방어 검증 |
| `06_5_7_historical_vulnerability_regression/` | 5.7 단계 과거 취약점/브레이크 회귀 레드팀 검증 | `5_7_historical_vulnerability_regression_raw_evidence.json`<br>`5_7_HISTORICAL_VULNERABILITY_REGRESSION_REPORT.txt` | 5.7에서 발견된 모든 historical breach(NPC부활, 챕터오버플로우, 출처위조, 인과조작 등)에 대한 VEIL 런타임 회귀 공격 및 15/15 방어 입증 기록 |
| `07_5_7_direct_adversarial_redteam/` | 5.7 원본 런타임 직접 적대적 레드팀 침투 감사 | `5_7_direct_adversarial_raw_evidence.json`<br>`5_7_DIRECT_ADVERSARIAL_REDTEAM_REPORT.txt` | 5.7 런타임 대상 18개 신규 벡터 무차별 침투 공격 및 3개 실시간 BREAK(세계비밀 덮어쓰기, 타임라인 조작, 복선 재해결) 입증 증거 |
| `18_root2_killchain_adversarial_forensics/` | Root 2 킬체인 적대적 포렌식 레드팀 감사 | `raw_evidence.json`<br>`REPORT.md` | Root 2 UPDATE_CHARACTER_STATS 권위 검증 우회 및 시드 자동그라운딩 공격 벡터 감사 기록 |
| `19_root2_deep_adversarial_killchain/` | Root 2 최종 딥 킬체인 19개 적대적 벡터 전수 감사 | `raw_evidence.json`<br>`REPORT.md` | 19개 적대적 벡터(후보자, 다중액션, 경계값, 시드위조, 클레임위조 등)에 대한 런타임 킬체인 검증 기록 |
| `20_root2_static_forensic_synthesis_and_conclusion/` | Root 2 정적 포렌식 전체 과정 및 최종 결론 불변 감사 기록 | `REPORT.md` | Root 2 발견부터 검증, Parser 자동그라운딩, 히스토리 리플레이, 엔티티/스코프 갭, 최종 판정표 및 아키텍처 결론 고정 기록 |

---

## 📝 향후 공격/감사 수행 지침

새로운 공격/감사 스크립트 실행 시:
- 반드시 `report/<0X_새로운_공격명>/` 형식의 새 하위 폴더를 생성하고,
- 해당 폴더 내에 JSON/TXT 형태의 Raw 증거물 및 분석 보고서를 불변 저장한 후 Git에 커밋합니다.

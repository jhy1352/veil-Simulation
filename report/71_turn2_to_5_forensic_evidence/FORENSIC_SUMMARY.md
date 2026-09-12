# TRPG 3.1 FORENSIC EVIDENCE PRESERVATION REPORT (TURN 2 TO 5)

## 1. 개요 및 포렌식 분류
- **대상 범위**: Turn 2 (수색/발견) → Turn 3 (주사위 판정/틈새 전진) → Turn 4 (구결 암호 해독) → Turn 5 (돌문 개방 및 공동 진입)
- **보존 디렉터리**: `/report/71_turn2_to_5_forensic_evidence/`
- **조사 목적**: 각 턴의 Player 입력, LLM raw response, Candidates, PreAuth, Commit 결과, Canonical State, 인벤토리 변동 원본 보존 및 인과 추적

---

## 2. 원본 아티팩트 및 SHA-256 체크섬

| 아티팩트 경로 | 구분 | 설명 | SHA-256 |
| :--- | :--- | :--- | :--- |
| `raw/01_turn2_raw.json` | RAW | Turn 2 전체 원본 증거 (입력, LLM 응답, 후보, 커밋, 상태) | `0b3d6a6e858ffc955519ae11b08f4ea867df5a76790e30e0423c73d457379787` |
| `raw/02_turn3_raw.json` | RAW | Turn 3 전체 원본 증거 (입력, LLM 응답, 후보, 커밋, 상태) | `7348f08c98c25df38bfa90d9fbc1b19cdcf13c1bfa9540ae33caaa3240880153` |
| `raw/03_turn4_raw.json` | RAW | Turn 4 전체 원본 증거 (입력, LLM 응답, 후보, 커밋, 상태) | `6c23ec6a5368f28257584c57baa5eb3094d8e64689fa2f93caf71d887bdaec42` |
| `raw/04_turn5_raw.json` | RAW | Turn 5 전체 원본 증거 (입력, LLM 응답, 후보, 커밋, 상태) | `628dd8d2c7bf54881580302d0c5e959be4dd9c7dfa69b8e808dd5dee8b0484cf` |
| `analysis/01_causality_chain_turn2_to_5.json` | RESULT | Turn 2~5 턴간 인과 연결 및 판정 체인 분석 | `5cdf18a2209c34a8bb46d4c1839dc8478a63625d8dddb06d85301efa00981b63` |
| `analysis/02_inventory_discrepancy_forensic.json` | RESULT | 인벤토리 변동 및 Proposal/Commit 전수 조사 | `3f2635a04357b779873267c60c9264ff07cb2a84c6d7828aca53e9965ed1ba65` |
| `analysis/03_pipeline_and_runtime_matrix.json` | RESULT | 모델 버전, Response ID, 레이턴시, PreAuth 판정 매트릭스 | `08ee94df3a6318b978a2372fa055e3bb9c4adec65a444c5ac278f0650f2d58c9` |

---

## 3. FACT (원본 증거 기반 사실 확정)

### [FACT 1] 플레이어 입력 및 서사 진행 원문
- **Turn 2**: `바닥에 떨어진 기괴한 조각상이 새겨진 돌판을 발견하고, 진기를 집중하여 문양을 살펴본다.`
- **Turn 3**: `돌판 옆 좁은 틈새에서 차가운 밤안개 같은 냉기가 흘러나오는 곳을 향해 검끝을 가리키며 천천히 전진한다.`
- **Turn 4**: `벽면에 희미하게 적혀 있는 고대 화산파의 구결(口訣)을 가사 속 암호와 대조하며 큰 소리로 읊조린다.`
- **Turn 5**: `구결이 끝나자 미세하게 떨리며 진동하는 돌문을 밀어젖히고 넓은 공동(空洞) 안으로 발을 내딛는다.`

### [FACT 2] 모델 호출 및 런타임 정보
- **사용 모델**: `gemini-3.5-flash` (모든 턴 동일)
- **Response ID**:
  * Turn 2: `YxeiauITmoDV7w_Ou_uADQ` (소요: 12.9s + 12.8s = 25.7s)
  * Turn 3: `fBeiatKUNtyAvr0Pi4vquA0` (소요: 8.2s + 11.0s = 19.2s)
  * Turn 4: `kBeiapUJj9PV7w-Rs_HpAQ` (소요: 14.1s + 14.0s = 28.1s)
  * Turn 5: `rBeiao-VC_aN1e8P8q_WkAo` (소요: 18.0s + 13.3s = 31.3s)

### [FACT 3] PreAuth 및 Sovereign Commit 결과
- **Turn 2**: PreAuth 결과 `REJECT` (`[EMPTY_PROPOSAL_REJECTED] State transition proposal contains no actions.`), Commit `null`
- **Turn 3**: PreAuth 결과 `REJECT` (`[EMPTY_PROPOSAL_REJECTED] State transition proposal contains no actions.`), Commit `null`
- **Turn 4**: PreAuth 결과 `REJECT` (`[EMPTY_PROPOSAL_REJECTED] State transition proposal contains no actions.`), Commit `null`
- **Turn 5**: PreAuth 결과 `REJECT` (`[EMPTY_PROPOSAL_REJECTED] State transition proposal contains no actions.`), Commit `null`

### [FACT 4] 인벤토리 상태 변화 분석 (추측 배제, 증거 기반)
- **Turn 2 시작/종료 인벤토리**: 은화 20개, 낡은 흑철검 1개
- **Turn 3 시작/종료 인벤토리**: 은화 20개, 낡은 흑철검 1개
- **Turn 4 시작/종료 인벤토리**: 은화 20개, 낡은 흑철검 1개
- **Turn 5 시작/종료 인벤토리**: 은화 20개, 낡은 흑철검 1개
- **원인 확정**:
  1. LLM Phase 1 및 Phase 2 어디에서도 `ADD_ITEM` 액션이 발행되지 않음.
  2. 서버 PreAuth에서 유효한 State Transition Proposal이 승인된 바 없음.
  3. Sovereign Engine(T6/T7)에서 인벤토리 변경이 커밋되지 않았으므로 초기 인벤토리가 완전하게 보존됨.

---

## 4. INFERENCE (추론)
- 헌법 제2조(World Authority), 제12조(LLM Authority 제한), 제13조(Narrative Isolation)에 따라 LLM의 텍스트 묘사(예: 돌판 발견, 구결 읊조림 등)는 Canonical State에 직접 아이템을 생성하거나 주입할 수 없음.
- 오직 검증된 `ADD_ITEM` State Transition Proposal이 PreAuth와 Sovereign Engine T6/T7 Commit을 통과해야만 인벤토리가 변경되도록 설계된 엔진의 동작이 정확히 작동함.

---

## 5. UNKNOWN (미확인 사항)
- LLM(Gemini-3.5-flash)이 탐색/발견 서사 생성 시 `ADD_ITEM` JSON 액션을 함께 출력하도록 유도하는 프롬프트 지시문의 강도 및 구조적 트리거 조건.

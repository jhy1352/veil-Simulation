# VEIL Engine Candidate Preservation Forensic Report
**Test ID:** 74_gemini_3_1_flash_lite_candidate_preservation_forensics  
**Execution Timestamp:** 2026-09-13T14:43:00.000Z  
**Target Model:** `gemini-3.1-flash-lite` (Strictly pinned, no fallback or model switch)  
**Test Scope:** 10 Turns of Standard TRPG Play (Natural Language Intent & Dynamic Action Progression)  
**Target Repository:** `https://github.com/jhy1352/veil-Simulation.git` (Branch: `work/pipeline-prune-from-ea8ca300`)  
**Raw Evidence Directory:** `report/raw/74_gemini_3_1_flash_lite_candidate_preservation_forensics/`  

---

## 1. Executive Summary & Funnel Analysis

### 1.1 Candidate Lifecycle Funnel (10-Turn Aggregated Metrics)

| Stage | Candidate Count | Retention Rate (Stage) | Retention Rate (Total) | Status |
| :--- | :---: | :---: | :---: | :---: |
| **1. LLM Candidate Generated** | **21** | 100.0% | 100.0% | GREEN |
| **2. Triage Gate Survived** | **21** | 100.0% | 100.0% | GREEN |
| **3. Recovery Gate Survived** | **20** | 95.2% | 95.2% | GREEN |
| **4. Recovery Gate Quarantined** | **1** | 4.8% (Quarantined) | N/A | YELLOW |
| **5. Semantic Contract / Translation** | **0** | **0.0%** | **0.0%** | **RED** |
| **6. MeaningTree Count** | **0** | 0.0% | 0.0% | RED |
| **7. Proposal Count** | **0** | 0.0% | 0.0% | RED |
| **8. PreAuth Input Count** | **0** | 0.0% | 0.0% | N/A |
| **9. Engine Input Count** | **0** | 0.0% | 0.0% | N/A |
| **10. Engine ACCEPT Count** | **0** | 0.0% | 0.0% | N/A |
| **11. Engine REJECT Count** | **0** | 0.0% | 0.0% | N/A |
| **12. Canonical Commit Count** | **0** | 0.0% | 0.0% | N/A |

---

## 2. Turn-by-Turn Lifecycle Tracking

| Turn | Action Type | LLM Gen | Triage Pass | Recovery Pass | Recovery Quarantine | MeaningTree | Proposal | PreAuth Allow | Engine ACCEPT | Commit | Final State |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Turn 1** | 이동 | 2 | 1 (block) | 1 | 1 | 0 | 0 | 0 | 0 | False | Fallback Non-Mutation |
| **Turn 2** | 환경 상호작용 | 3 | 1 (block) | 3 | 0 | 0 | 0 | 0 | 0 | False | Fallback Non-Mutation |
| **Turn 3** | 아이템 관찰 | 2 | 1 (block) | 2 | 0 | 0 | 0 | 0 | 0 | False | Fallback Non-Mutation |
| **Turn 4** | 아이템 획득 | 2 | 1 (block) | 2 | 0 | 0 | 0 | 0 | 0 | False | Fallback Non-Mutation |
| **Turn 5** | NPC 상호작용 | 2 | 1 (block) | 2 | 0 | 0 | 0 | 0 | 0 | False | Fallback Non-Mutation |
| **Turn 6** | 복합 (아이템+대화) | 2 | 1 (block) | 2 | 0 | 0 | 0 | 0 | 0 | False | Fallback Non-Mutation |
| **Turn 7** | 결과 이용 후속 | 2 | 1 (block) | 2 | 0 | 0 | 0 | 0 | 0 | False | Fallback Non-Mutation |
| **Turn 8** | 인과 후속 행동 | 2 | 1 (block) | 2 | 0 | 0 | 0 | 0 | 0 | False | Fallback Non-Mutation |
| **Turn 9** | 아이템 사용 | 2 | 1 (block) | 2 | 0 | 0 | 0 | 0 | 0 | False | Fallback Non-Mutation |
| **Turn 10** | 일반 의도 | 2 | 1 (block) | 2 | 0 | 0 | 0 | 0 | 0 | False | Fallback Non-Mutation |

---

## 3. Classification of Evidence (FACT / INFERENCE / HYPOTHESIS / UNKNOWN)

### FACT (Runtime Evidence & Code Inspection)
1. **Model Identity**: 100% of calls successfully executed using `gemini-3.1-flash-lite`. Response metadata confirmed `actualModelVersion: "gemini-3.1-flash-lite"`.
2. **LLM Candidate Generation**: LLM generated a total of 21 candidates across 10 turns (2 or 3 per turn).
3. **Triage Gate**: All 10 turns contained valid `[CANDIDATES_BLOCK]` and `[ZERO_MUTATION_NARRATIVE]` blocks. Zero Triage failures occurred.
4. **Recovery Gate**: Out of 21 raw candidates, 20 passed structural recovery validation (95.2%). Exactly 1 candidate (Turn 1, Candidate 2) was quarantined with reason: `"narrativeSummary must be a string (got undefined)"` because the LLM emitted `"narrativeSuccess"` instead of `"narrativeSummary"`.
5. **Semantic Translation Bottleneck**: 0 out of 20 Recovery-surviving candidates were compiled into a `MeaningTree` or `StateTransitionProposal`.
6. **Exact Code Cause of Bottleneck**: In `src/engine/language/runtimeSemanticCandidate.ts` (line 55), `validateSemanticEventShape` strictly enforces `typeof event.modality === 'string'`. However, `gemini-3.1-flash-lite` outputs `semanticEvents` without the optional `modality` field (leaving it `undefined`). While `semanticCandidateContract.ts` defaults missing modality to `'NONE'`, `runtimeSemanticCandidate.ts` shape validation executes prior to compiler mapping and rejects 100% of LLM-generated candidates with error `SHAPE_INVALID: "semanticEvents[0].modality is required"`.
7. **Engine Input Count**: Because translation failed at Step 5, 0 candidates reached PreAuth or the Sovereign Engine. No Engine ACCEPT or REJECT determinations occurred.

### INFERENCE
1. **Pipeline Loss vs Engine Over-Rejection**: The 0% commit rate in this 10-turn run is 100% attributable to **Pipeline Transport Loss (Case 1)** at the Semantic Event shape validation boundary, NOT Engine over-rejection (Case 2) or Canonical State conflicts.
2. **Item Acquisition Tracking**: In Turn 4, the player attempted to take silver coins (`TAKE item X`). The candidate was preserved through Recovery Gate, but dropped at Semantic Event shape validation due to missing `modality`. Consequently, no `MODIFY_INVENTORY` action was generated, no item was added to Canonical Inventory, and subsequent turns (Turns 6 & 9) operated on an empty inventory.

### HYPOTHESIS
1. Defaulting `modality` to `'NONE'` inside `validateSemanticEventShape` (matching `semanticCandidateContract.ts` behavior) will immediately unblock the pipeline and allow candidates to reach MeaningTree, PreAuth, and Engine evaluation without structural schema rejections.

### UNKNOWN
1. Once Candidate shape validation permits missing `modality`, the exact ACCEPT vs REJECT ratio at the Sovereign Engine level for `gemini-3.1-flash-lite` generated proposals cannot be determined without running a post-fix forensic test.

---

## 4. Answers to Final Report Core Questions

### Q1. 정상적인 Candidate가 실제로 어느 정도 비율로 Engine까지 도달했는가?
**0.0% (0 / 21)**. 
LLM이 생성하고 Recovery Gate를 통과한 20개의 정상 Candidate 모두 Engine 전 단계인 Causal Translation / Semantic Event Shape Validation에서 소실되었습니다.

### Q2. Engine에 도달하기 전에 가장 많이 소실된 단계는 어디인가?
**Semantic Event Shape Validation (`runtimeSemanticCandidate.ts`)**.
Recovery Gate를 통과한 Candidate 20개 중 20개(100%)가 이 단계에서 소실되었습니다.

### Q3. Candidate의 온전한 정보가 Pipeline에서 불필요하게 제거된 사례가 있는가?
**예 (FACT)**.
`gemini-3.1-flash-lite`가 생성한 `semanticEvents` 배열에 `modality` 필드가 생략되었으나, `runtimeSemanticCandidate.ts`의 `validateSemanticEventShape`가 이를 필수값으로 요구하여 유효한 의미 구조 전체를 `SHAPE_INVALID`로 파기하였습니다.

### Q4. Engine REJECT 중 실제 인과적/Canonical 이유가 아닌 과잉 거부가 의심되는 사례가 있는가?
**N/A (Engine 미도달)**.
이번 10턴 런타임 테스트에서는 Candidate가 Engine까지 도달하지 못했으므로, Engine 단계에서의 과잉 거부는 발생하지 않았습니다.

### Q5. 아이템 획득 Candidate가 Pipeline 또는 Engine에서 어떻게 처리되었는가?
Turn 4에서 플레이어의 은화 획득 선언에 대해 LLM이 Candidate를 생성하여 Recovery Gate까지 정상 전달(Recovery Pass)되었으나, Semantic Event Shape Validation에서 `modality` 미비로 소실되어 Engine에 전달되지 못했고 Canonical Inventory에 반영되지 않았습니다.

### Q6. 현재 문제의 1차 원인이 LLM Candidate 생성인지, Pipeline 소실인지, Engine 판정인지 구분할 수 있는가?
**1차 원인: Pipeline 소실 (Case 1)**.
- LLM Candidate 생성: 21개 생성 (양호)
- Recovery Gate: 20개 통과 (95.2% 통과율)
- Pipeline 소실: Semantic Shape Validation (`modality is required`) 단일 지점에서 100% 소실.

### Q7. 추가 런타임 테스트가 필요한가?
**필요함**.
Pipeline 소실 지점(`validateSemanticEventShape` 내 `modality` 기본값 미처리)에 대한 정밀 교정 후, 실제로 Candidate가 Engine에 도달했을 때의 Engine ACCEPT/REJECT 비율을 확인하기 위한 2차 런타임 포렌식 테스트가 필요합니다.

---

## 5. Raw Evidence File Index

All raw JSON files generated during this 10-turn forensic test are preserved untouched in:
`report/raw/74_gemini_3_1_flash_lite_candidate_preservation_forensics/`

- `turn_01_raw.json`: Turn 1 Raw Input/Output & Trace
- `turn_02_raw.json`: Turn 2 Raw Input/Output & Trace
- `turn_03_raw.json`: Turn 3 Raw Input/Output & Trace
- `turn_04_raw.json`: Turn 4 Raw Input/Output & Trace (Item TAKE)
- `turn_05_raw.json`: Turn 5 Raw Input/Output & Trace
- `turn_06_raw.json`: Turn 6 Raw Input/Output & Trace (Item USE + Dialogue)
- `turn_07_raw.json`: Turn 7 Raw Input/Output & Trace
- `turn_08_raw.json`: Turn 8 Raw Input/Output & Trace
- `turn_09_raw.json`: Turn 9 Raw Input/Output & Trace (Item USE)
- `turn_10_raw.json`: Turn 10 Raw Input/Output & Trace
- `summary_raw_evidence.json`: 10-Turn Aggregated Metrics and Execution Manifest

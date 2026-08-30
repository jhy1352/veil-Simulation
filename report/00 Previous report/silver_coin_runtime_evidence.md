# TRPG 3.1 런타임 포렌식 증거 보고서: 은화 인벤토리/서사 불일치 (Silver Coin Discrepancy)

**보고 일시:** 2026-08-25T17:20:18.334Z  
**조사 대상 브랜치/코드베이스:** `main` (Active Runtime)  
**분석 유형:** 실제 런타임 실행 경로 추적 및 상태 검증 로그 (Forensic Evidence Collection)

---

## 1. 개요 및 조사 목적
플레이 도중 발생한 **「서사에서는 은화를 획득했다고 묘사되었으나 Canonical Inventory에는 반영되지 않았고, 다음 턴에서 LLM이 은화의 존재를 계속 서술한 현상」**의 전체 런타임 경로(Context Assembly → Gemini Request → Parser → Proposal → Validator → Commit Gate → Inventory → Next Turn Context)를 실제 런타임 코드로 실행하여 RAW 증거를 수집함.

---

## 2. 런타임 실행 경로별 증거 (Step-by-Step Evidence)

### Step 1. Turn 1 Player Input
```
"노인에게 산에서 캔 약초를 건네고 고마움의 표시로 은화를 받는다."
```

### Step 2. Turn 1 `server.ts` Context Assembly
- `initialContextPrompt` 소장품 상태: `목검(x1)`
- 정사 인벤토리에 '은화' 없음.

### Step 3. Turn 1 Gemini Raw Response
```
노인은 거친 손으로 건네받은 약초를 소중하게 감싸 안으며 깊은 한숨과 함께 미소를 지었다.

"고맙네, 젊은이. 이 약초가 없었다면 손녀의 열병을 가라앉힐 수 없었을 게야. 얼마 되지 않지만 내 성의니 부디 받아두게."

노인은 낡은 전대를 풀어 은화 세 냥을 꺼내 청운의 손에 쥐어주었다. 차가운 금속의 감촉이 손바닥에 묵직하게 전해졌다.

```markdown
1) [외부 검색 및 사실 검증]: 약초와 은화 거래의 시대적 타당성 확인
2) [미회수 복선]: 없음
3) [정세 및 사건]: 객잔 인근 마을의 평온한 하루
4) [진행 및 예정 챕터 현황]: 현재: 1장: 강호의 첫걸음 | 예정: 1) 2장: 객잔의 소란 | 2) 3장: 비급의 행방 | 3) 4장: 결전의 날
5) [스탯 및 소장품 변화]: 소장품 추가: 은화(x3) 획득 (노인의 보답)
6) [DC 판정 근거]: 거래 성립으로 별도 판정 불필요
7) [상황 대조 및 개연성 검증 선언]: 약초 제공에 대한 상호 보답 확인
```

```json
{
  "intentSummary": "Turn 1 노인과의 약초 교환 및 은화 획득",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "item": {
          "name": "은화",
          "quantity": 3
        },
        "operation": "ADD",
        "acquisition": {
          "cause": "GIFT_REWARD"
        }
      }
    }
  ]
}
```
```

### Step 4. Turn 1 Parser (`parser.ts` / `parseGMResponseMetaData`)
- `cleanText`: 산문 텍스트 추출 완료 ("노인은 낡은 전대를 풀어 은화 세 냥을 꺼내 청운의 손에 쥐어주었다...")
- `metaData.inventoryChanges`: `[{ name: "은화", quantity: 3, action: "add", cause: "GIFT_REWARD" }]`

### Step 5. Turn 1 Candidate Packet (`extractCandidatesFromMetadata`)
- `candidate.inventoryChanges`:
```json
[
  {
    "name": "은화",
    "quantity": 3,
    "action": "add",
    "cause": "GIFT_REWARD",
    "acquisition": {
      "cause": "GIFT_REWARD"
    }
  }
]
```

### Step 6. Turn 1 State Transition Proposal (`proposalParser.ts`)
- `proposal.actions[0]`:
```json
{
  "type": "ADD_NARRATIVE_SEED",
  "payload": {
    "id": "seed-mt8xknmh-5wam0g",
    "content": "없음",
    "status": "active",
    "turnCreated": 1
  }
}
```

### Step 7. Turn 1 Validator & Commit Gate (`validator.ts` / `sovereignEngine.ts`)
- **결과:** `FAILED (success: false)`
- **Rejection Reasons:**
```json
[
  "[CAUSALITY_VIOLATION] Unbacked GIFT_REWARD of '은화' lacks verifiedEventId grounding."
]
```
- **Conflict Details:**
```json
[
  "[CAUSALITY_VIOLATION] Action #4: Acquisition 'GIFT_REWARD' of '은화' lacks verifiedEventId grounding."
]
```
- **근거:** `validator.ts` lines 613-617: `GIFT_REWARD` 원인의 아이템 획득 시 선행 정사 사건(`verifiedEventId`)이 존재하지 않아 인과율 위반(`[CAUSALITY_VIOLATION]`)으로 기각됨.

### Step 8. Turn 1 Post-Commit Canonical State Inventory
- `Snapshot Character Inventory`: `[ { "id": "item-wood-sword", "name": "목검", "quantity": 1 } ]`
- **은화 반영 여부:** **NO (미반영)**

### Step 9. Turn 2 `server.ts` Context Assembly & Gemini Request
- `initialContextPrompt` 소장품: `목검(x1)` (정사 인벤토리 일치)
- `literalWindow` (직전 서사 기록): Turn 1의 모델 서사("노인은 낡은 전대를 풀어 은화 세 냥을 꺼내...")가 포함됨.

### Step 10. Turn 2 Gemini Response (Narrative Feedback Loop 발생)
- **응답 내용:**
> "...청운은 품속에 손을 넣어 아까 노인에게 받은 차가운 은화 세 냥을 매만졌다..."
- **현상:** LLM이 Canonical State의 소장품 목록(`목검(x1)`) 대신 대화 기록(`literalWindow`)의 이전 턴 서사를 사실로 인지하여 은화 서술을 지속함 (헌법 제12조 Narrative Feedback Loop 위반).

---

## 3. 포렌식 사실 확인 요약 (Factual Findings)

1. **엔진 주권의 정상 작동 (Engine Defense Succeeded):**
   - 선행 정사 사건 근거(`verifiedEventId`)가 없는 은화 추가 제안은 엔진 검증 관문(`validator.ts`)에서 정확히 `[CAUSALITY_VIOLATION]`으로 차단되었으며, Canonical Inventory는 오염되지 않고 순수성을 유지함.
2. **서사-인벤토리 불일치 발생 메커니즘 (Root Mechanism):**
   - Gemini가 Turn 1에서 은화를 주는 서사를 임의로 작성함.
   - 엔진은 은화 추가 제안을 기각함 (인벤토리에는 목검만 남음).
   - Turn 2 프롬프트 조립 시, `server.ts`는 정사 인벤토리(`소장품: 목검(x1)`)와 함께 직전 대화 기록(`literalWindow`)을 전송함.
   - Gemini가 정사 인벤토리보다 대화 기록 서사를 우선시하여 은화를 소지하고 있는 것으로 서술함.
3. **제품 코드 무변경 확인 (No Product Code Change):**
   - 본 포렌식은 런타임 코드 분석 및 포렌식 러너 스크립트를 통한 실제 로그 증거 수집으로만 진행되었으며, 어떠한 제품 코드도 수정되지 않았음.

---
**RAW 로그 첨부:** `idea/report/silver_coin_runtime_raw.txt`

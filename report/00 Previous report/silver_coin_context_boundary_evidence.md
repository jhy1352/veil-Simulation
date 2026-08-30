# TRPG 3.1 은화 사건 후속 런타임 신뢰경계 조사 보고서 (Silver Coin Context Boundary Forensic Report)

**조사 일시:** 2026-08-25T18:17:10.347Z  
**조사 대상 브랜치/코드베이스:** `main`  
**HEAD SHA:** d246c22  
**조사 성격:** 제품 코드 무변경 사실 기반 런타임 포렌식 추적

---

## 1. 5대 핵심 질문별 검증 결과

### 1) Canonical State와 Narrative History의 Context 구분 방식
- **실제 코드 위치:** `server.ts` lines 433-504
- **구조:**
  - `initialContextPrompt`에 `worldInfo`, `character`(스탯, 소장품 등), `seeds`, `offscreen`, `chapters`가 문자열 블록으로 조립됨.
  - `literalWindow` (`messages.slice(-20)`)는 이전 턴의 사용자/모델 대화 전문이 `{ role: 'user' | 'model', parts: [{ text }] }` 형태로 조립됨.
  - `initialContextPrompt`는 `literalWindow`의 **첫 번째 메시지(idx === 0)의 상단에 1회만 프리펜드**됨.
  - 2번째 메시지부터는 순수 대화 기록 텍스트만 전송됨.

### 2) 거부된 Action/서사의 다음 턴 Context 재투입 여부
- **실제 코드 위치:** `src/App.tsx` lines 513-540 및 lines 624-637
- **확인된 사실 (VERIFIED):**
  - 엔진 Commit Gate가 제안을 `REJECTED`(예: `[CAUSALITY_VIOLATION]`) 처리하여 Canonical State는 변경되지 않음.
  - 그러나 `App.tsx` lines 624-637에서 `rawOutputText`(은화 획득 묘사가 포함된 모델 산문)가 `messages` 배열에 그대로 `assistant` 롤로 `setMessages`에 추가됨.
  - 따라서 다음 턴(/api/chat 요청)의 `messages` 배열에 **엔진이 거부한 서사가 그대로 포함되어 백엔드로 전송됨**.

### 3) literalWindow가 Canonical State보다 높은 신뢰도로 해석될 수 있는 코드 구조
- **실제 코드 위치:** `server.ts` lines 493-504 및 Gemini LLM 프롬프트 조립
- **확인된 사실 (VERIFIED):**
  - `MASTER_SYSTEM_INSTRUCTION`(lines 73-84)에는 "1위: Engine Canonical State > 9위: Previous Narrative Context" 및 "past narrative conflicts with Canonical State, the Canonical State ALWAYS prevails"가 명시되어 있음.
  - 그러나 `literalWindow`의 모델 턴(model turn) 텍스트에 "은화 세 냥을 꺼내 청운의 손에 쥐어주었다"는 문학적 묘사가 직전 턴 어시스턴트 출력으로 존재함.
  - LLM은 이전 턴 자신의 어시스턴트 출력(model message)을 문맥적 연속성으로 인식하여, Canonical Inventory(소장품: 목검(x1))와 충돌함에도 직전 턴 서사의 은화를 참조하여 서사를 지속함 (Narrative Feedback Loop 발생).

### 4) 권위 차이를 명시적으로 전달하는 지침의 실제 존재 여부
- **실제 코드 위치:** `server.ts` lines 70-85 (`MASTER_SYSTEM_INSTRUCTION`)
- **확인된 사실 (VERIFIED):**
  - `server.ts` lines 73-84에 10단계 Truth Priority가 명시되어 있음.
  - `server.ts` line 84: `Previous narrative is reference context only. If past narrative conflicts with Canonical State, the Canonical State ALWAYS prevails.`
  - `server.ts` lines 453-454: `1위: Engine Canonical State (세계 법칙/사실) > 2위: 플레이어의 최신 행동 선언 > ... > 6위: 이전 턴 로드맵(참고자료)` 지침이 존재함.

### 5) 거부된 LLM 서사가 이후 턴에서 Canonical Fact로 재승격될 수 있는 실제 경로 추적
- **시나리오 A: 허구 은화를 소비(RESOURCE_EXCHANGE)하여 아이템을 구매하려는 경우**
  - 결과: `[CAUSALITY_VIOLATION] Owned item '은화' required for cost is not present in inventory` -> **엔진이 완벽 차단 (차단 성공)**
- **시나리오 B: 같은 턴 내에서 ADD_NARRATIVE_SEED를 생성하고 이를 verifiedEventId로 자가 증명(Self-Proof)하려는 경우**
  - 결과: `[CAUSALITY_VIOLATION] verifiedEventId '...' does not exist in canonical world state, history, or active context` -> **엔진이 완벽 차단 (차단 성공)**
- **시나리오 C: 정사 인벤토리 직접 수정(OVERWRITE_CHARACTER / SET_QUANTITY)**
  - 결과: LLM 출처는 ACL 및 ID 매칭 규칙에 의해 거부됨 -> **엔진이 완벽 차단 (차단 성공)**
- **결론 (VERIFIED):**
  - 거부된 허구 서사가 Canonical State로 **재승격(Re-promotion)되는 경로는 엔진에 의해 완전히 차단**되어 있음.
  - Canonical Inventory는 계속 무결성을 유지함 (`목검(x1)`).
  - 단, **서사 계층(Narrative Prose)**에서는 LLM이 이전 대화 기록을 기반으로 환각을 이어가는 현상이 유지됨.

---

## 2. 런타임 RAW 증거
- 전체 원본 로그: `idea/report/silver_coin_context_boundary_raw.txt`

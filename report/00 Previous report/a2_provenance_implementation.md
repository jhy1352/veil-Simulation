# TRPG 3.1 Sovereign Engine — A-2 Provenance Boundary 및 Self-Proof 제거 구현·검증 보고서

**문서 ID**: `REPORT-A2-PROVENANCE-AUDIT-2026-08-24`  
**문서 상태**: 공식 교차검수용 아카이브 (Formal Cross-Verification Evidence)  
**제품 코드 변경 여부**: **본 보고서 작성 시점에는 제품 코드(`src/engine/validator.ts`, `src/engine/actionApplier.ts` 등)를 일체 변경하지 않았으며, 오직 검증 증거 보고서 파일만 갱신함.**

---

## 1. 구현 대상 및 구현 목적 (Target & Objective)

### 1.1 구현 대상
- `src/engine/validator.ts`: 상태 전이 제안(State Transition Proposal) 검증 엔진
- `src/engine/actionApplier.ts`: 검증된 액션을 Canonical Draft에 반영하는 액션 적용기
- `src/engine/testRunner.ts`: 엔진 주권 및 보안 경계 단위/적대적 테스트 러너

### 1.2 구현 목적
1. **Provenance Boundary (출처 경계) 강제**:
   - `UPDATE_NPC`, `UPDATE_FACTION`, `SET_CHARACTER_SECRET`, `SET_WORLD_METADATA` 등 기존 세계 상태를 변조하는 작업에 대해 **사전 존재하는 독립된 정규 증거(Independent Canonical Evidence)**를 필수로 요구함.
   - 플레이어 주장(`Player Claim`)이나 LLM의 단독 주장(`LLM Candidate`)이 검증 없이 현실로 확정되는 경로를 원천 차단.
2. **5.7 Self-Proof (동일 제안 내 자가 입증) 취약점 완전 제거**:
   - `MODIFY_INVENTORY` 액션이 동일 Proposal 내에서 함께 생성된 신규 Draft 복선(`ADD_NARRATIVE_SEED`)이나 오프스크린 사건(`RECORD_OFFSCREEN_EVENT`)을 인과적 선행 근거(`verifiedEventId`)로 삼아 자가 증명(Self-Proof)하여 아이템을 생성하던 결함을 제거.
   - 오직 **해당 Proposal 이전에 이미 커밋된 정규 상태(`currentState`) 또는 과거 역사 기록(`historyRecords`)**만을 유효한 증거로 인정.
3. **LLM Creative Freedom (창작의 자유) 완전 보존**:
   - 신규 NPC 등록(`ADD_NPC`), 세력 등록(`ADD_FACTION`), 복선 추가(`ADD_NARRATIVE_SEED`), 오프스크린 사건 기록(`RECORD_OFFSCREEN_EVENT`) 등 새로운 서사 요소의 확장은 제약 없이 자유롭게 커밋되도록 보장.

---

## 2. 실제 변경 파일 목록 및 변경 사유 (Modified Files & Rationale)

| 파일 경로 | 변경 내용 요약 | 변경 사유 |
| :--- | :--- | :--- |
| `src/engine/validator.ts` | 1. `UPDATE_NPC`, `UPDATE_FACTION` 대상 검증 시 Draft 참조 제거 및 `currentState` 사전 존재 검증 강제<br>2. `SET_WORLD_METADATA`, `SET_CHARACTER_SECRET` 비신뢰 소스(`LLM`, `PLAYER`) 차단<br>3. `MODIFY_INVENTORY`에서 동일 제안 내 액션 검색(E. Intra-proposal actions) 루프 완전 제거 | 헌법 제2조, 제7조, 제11조, 제20조 위반 방지 및 5.7 Self-Proof 공격 경로 차단 |
| `src/engine/actionApplier.ts` | `RECORD_OFFSCREEN_EVENT` 실행 시 `payload.id`가 제공된 경우 임의 타임스탬프 ID로 덮어쓰지 않고 제공된 식별자 유지 | 오프스크린 이벤트 ID의 인과적 추적성 및 정규 기록 참조 무결성 확보 |
| `src/engine/testRunner.ts` | 1. `TEST-H4-I`에서 선행 오프스크린 이벤트를 사전 커밋하는 정규 경로로 테스트 픽스처 보정<br>2. `TEST-A2-1` ~ `TEST-A2-6` 6종의 전용 적대적/경계 검증 테스트 추가 | A-2 요구사항의 정밀 검증 및 회귀 방지 |

---

## 3. 핵심 변경 코드의 위치 및 역할 (Code Locations & Mechanisms)

### 3.1 5.7 Self-Proof 제거: `src/engine/validator.ts` (Lines 652~705)
- **위치**: `case 'MODIFY_INVENTORY':` 내 `verifiedEventId` 유효성 검사 블록
- **코드 역할**:
  ```typescript
  // A. Narrative Seeds in Current State (pre-existing prior to proposal)
  const matchingSeed = currentState.worldInfo.seeds.find(s => s.id === verifiedEventId);
  if (matchingSeed) {
    foundEventText = matchingSeed.content;
    eventIsActive = matchingSeed.status === 'active';
  }

  // B. Offscreen Records in Current State (pre-existing prior to proposal)
  if (!foundEventText && currentState.worldInfo.offscreenRecords) {
    const matchingOff = currentState.worldInfo.offscreenRecords.find(o => o.id === verifiedEventId);
    if (matchingOff) {
      foundEventText = matchingOff.eventDescription;
      eventIsActive = true;
    }
  }

  // C. Camera Offscreen Events in Current State (pre-existing prior to proposal)
  if (!foundEventText && currentState.worldInfo.cameraOffscreenEvents) {
    const matchingCam = currentState.worldInfo.cameraOffscreenEvents.find(e => e === verifiedEventId);
    if (matchingCam) {
      foundEventText = matchingCam;
      eventIsActive = true;
    }
  }

  // D. Historical Records (pre-existing prior to proposal)
  if (!foundEventText && historyRecords && historyRecords.length > 0) {
    const matchingHist = historyRecords.find(r => r.eventId === verifiedEventId || r.recordId === verifiedEventId);
    if (matchingHist) {
      foundEventText = matchingHist.narrativeSummary || matchingHist.resultingStateSummary || '';
      eventIsActive = true;
    }
  }

  // [REMOVED] E. Intra-proposal Actions (Intra-proposal actions and draft data CANNOT serve as canonical evidence)
  if (!foundEventText) {
    conflictDetails.push(`[CAUSALITY_VIOLATION] Action #${i + 1}: verifiedEventId '${verifiedEventId}' does not exist in canonical world state, history, or active context.`);
    rejectedReasons.push(`[CAUSALITY_VIOLATION] Event '${verifiedEventId}' not found in canonical records.`);
    actionValid = false;
  }
  ```

### 3.2 `UPDATE_NPC` Provenance Boundary: `src/engine/validator.ts` (Lines 418~438)
- **코드 역할**:
  ```typescript
  case 'UPDATE_NPC': {
    const { id, changes } = action.payload || {};
    // Section 5.6 Provenance Boundary: Only pre-existing canonical NPCs can be updated.
    const preExistingNpc = currentState.worldInfo.npcs.find(n => n.id === id);
    if (!preExistingNpc) {
      conflictDetails.push(`[PROVENANCE_VIOLATION] Action #${i + 1}: NPC with id '${id}' does not exist in pre-existing canonical state.`);
      rejectedReasons.push(`[PROVENANCE_VIOLATION] NPC '${id}' cannot be updated as it has no pre-existing canonical evidence.`);
      actionValid = false;
      break;
    }
    // ...
  }
  ```

### 3.3 `UPDATE_FACTION` Provenance Boundary: `src/engine/validator.ts` (Lines 478~495)
- **코드 역할**:
  ```typescript
  case 'UPDATE_FACTION': {
    const { id, changes } = action.payload || {};
    // Section 5.6 Provenance Boundary: Only pre-existing canonical factions can be updated.
    const preExistingFaction = currentState.worldInfo.factions.find(f => f.id === id);
    if (!preExistingFaction) {
      conflictDetails.push(`[PROVENANCE_VIOLATION] Action #${i + 1}: Faction with id '${id}' does not exist in pre-existing canonical state.`);
      rejectedReasons.push(`[PROVENANCE_VIOLATION] Faction '${id}' cannot be updated as it has no pre-existing canonical evidence.`);
      actionValid = false;
      break;
    }
    // ...
  }
  ```

### 3.4 `SET_WORLD_METADATA` Provenance Boundary: `src/engine/validator.ts` (Lines 310~324)
- **코드 역할**:
  ```typescript
  const isSystemSource = proposal.source === 'GENESIS' ||
                         proposal.source === 'SYSTEM' ||
                         proposal.source === 'SAVE_HYDRATION' ||
                         proposal.source === 'CLOUD_RESTORE' ||
                         proposal.source === 'ENGINE_INTERNAL';
  if (!isSystemSource) {
    conflictDetails.push(`[PROVENANCE_VIOLATION] Action #${i + 1}: Modifying canonical world metadata via untrusted source '${proposal.source}' is prohibited without independent canonical evidence.`);
    rejectedReasons.push(`[PROVENANCE_VIOLATION] Canonical world metadata cannot be altered by source '${proposal.source}' without independent canonical evidence.`);
    actionValid = false;
  }
  ```

### 3.5 `SET_CHARACTER_SECRET` Provenance Boundary: `src/engine/validator.ts` (Lines 842~858)
- **코드 역할**:
  ```typescript
  const isSystemSource = proposal.source === 'GENESIS' ||
                         proposal.source === 'SYSTEM' ||
                         proposal.source === 'SAVE_HYDRATION' ||
                         proposal.source === 'CLOUD_RESTORE' ||
                         proposal.source === 'ENGINE_INTERNAL';
  if (!isSystemSource) {
    conflictDetails.push(`[PROVENANCE_VIOLATION] Action #${i + 1}: Setting or mutating character secret via untrusted source '${proposal.source}' is prohibited without independent canonical evidence.`);
    rejectedReasons.push(`[PROVENANCE_VIOLATION] Character secret cannot be modified or established by source '${proposal.source}' without independent canonical evidence.`);
    actionValid = false;
  }
  ```

---

## 4. 3대 핵심 검증 파이프라인 및 경계 구분 (Architectural Paths & Boundary Classification)

### 4.1 3대 핵심 검증 경로 (Core Validation Pipelines)
1. **플레이어 주장 검증 경로**:
   $$\text{Player Claim} \longrightarrow \text{LLM} \longrightarrow \text{Candidate} \longrightarrow \text{Proposal (Source: PLAYER/LLM)} \longrightarrow \text{Validator (Conflict \& Provenance Check)} \longrightarrow \text{Commit}$$
   - 플레이어의 자연어 진술은 즉시 현실이 되지 않고 `CLAIMED` 상태로 제안되며, Validator에서 사전 정규 증거와 대조되어 통과 시에만 Commit됨.
2. **LLM 서사 창작 경로**:
   $$\text{LLM Creative Output} \longrightarrow \text{Candidate} \longrightarrow \text{Proposal (Source: LLM)} \longrightarrow \text{Validator (Schema \& Structural Check)} \longrightarrow \text{Commit}$$
   - 신규 엔티티(`ADD_NPC`, `ADD_FACTION`, `ADD_NARRATIVE_SEED`, `RECORD_OFFSCREEN_EVENT`)는 기존 정규 사실과의 충돌이 없는 한 자유롭게 승인됨.
3. **독립적 정규 증거 인과 경로**:
   $$\text{Independent Canonical Evidence (Pre-existing State / History)} \longrightarrow \text{Proposal Action (Cause Ref)} \longrightarrow \text{Validator} \longrightarrow \text{Commit}$$
   - 아이템 획득, 기정 사실 변조 등은 오직 이전 턴에 정규 승인된 증거에 의해서만 인과가 성립됨.

### 4.2 3대 액션 경계의 코드상 엄격한 구분 (Boundary Classification)

| 액션 분류 경계 | 대상 액션 타입 | 검증 방식 및 적용 원칙 |
| :--- | :--- | :--- |
| **`CREATIVE`** | `ADD_NPC`, `ADD_FACTION`, `ADD_NARRATIVE_SEED`, `RECORD_OFFSCREEN_EVENT`, `ADD_RUMOR` | **사전 증거 불필요**. 스키마 적합성, 중복 ID 여부, 활성 복선 상한(최대 3개) 등의 구조적 경계만 충족하면 LLM/PLAYER의 창작이 즉시 허용됨. |
| **`EVIDENCE_REQUIRED`** | `UPDATE_NPC`, `UPDATE_FACTION`, `SET_NPC_STATUS`, `SET_WORLD_METADATA`, `SET_CHARACTER_SECRET` | **사전 존재하는 정규 엔티티 증거 필수**. `currentState.worldInfo`에 이미 존재하는 대상만 수정 가능하며, 세계 법칙 및 캐릭터 비밀은 비신뢰 런타임 소스로부터의 변조가 원천 차단됨. |
| **`CAUSAL_REQUIRED`** | `MODIFY_INVENTORY` (`ADD`, `REMOVE`, `SET_QUANTITY`), `RECORD_PHYSICAL_DEFECT`, `RECORD_DICE_RESULT` | **인과적 트랜잭션 증거 필수**. 획득(`ADD`)은 반드시 정규 사전 이벤트 ID(`verifiedEventId`) 또는 등가 교환(`RESOURCE_EXCHANGE` 비용 차감)이 동반되어야 하며, 자가 입증은 기각됨. |

---

## 5. 5.7 Self-Proof 제거 전후의 실제 검증 경로 비교

### [제거 전 결함 경로]
1. LLM이 `ADD_NARRATIVE_SEED (id: 'seed-instant', content: '보물상자')`와 `MODIFY_INVENTORY (ADD, cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-instant')`를 단일 Proposal에 동시 포함.
2. Validator가 `proposal.actions` 내부를 순회(Intra-proposal search)하여 앞선 액션에서 `'seed-instant'`가 선언된 것을 발견.
3. 정규 세계에 아직 승인되지도 않은 제안 단계의 가공 데이터를 증거로 인정하여 인벤토리에 아이템이 생성됨 (**5.7 Self-Proof 공격 취약점**).

### [제거 후 방어 경로]
1. LLM이 동일한 공격 제안을 제출.
2. Validator는 오직 `currentState.worldInfo.seeds`, `currentState.worldInfo.offscreenRecords`, `historyRecords` 등 **제안 이전의 정규 상태**에서만 `'seed-instant'`를 검색.
3. 사전 정규 기록에 존재하지 않으므로 `[CAUSALITY_VIOLATION] Event 'seed-instant' not found in canonical records.` 에러와 함께 **Proposal 전체를 원자적 기각 (Zero Mutation)**.

---

## 6. 추가/수정된 테스트 목록 및 적대적 시나리오 분석 (Test Suite Audit)

### 6.1 A-2 전용 테스트 상세 (`src/engine/testRunner.ts`)

#### 1. `TEST-A2-1`: UPDATE_NPC 대상 사전 존재성 검증 (EVIDENCE_REQUIRED)
- **공격 시나리오**: LLM이 정규 세계에 등록된 적 없는 가공의 NPC ID(`npc-unbacked-ghost`)의 상태와 인상을 갱신(`UPDATE_NPC`)하려는 제안 제출.
- **코드 검증 동작**: `currentState.worldInfo.npcs.find(n => n.id === 'npc-unbacked-ghost')` 검사 실패.
- **결과**: `[PROVENANCE_VIOLATION] NPC 'npc-unbacked-ghost' cannot be updated as it has no pre-existing canonical evidence.` 발생 및 Proposal 기각. (PASS)

#### 2. `TEST-A2-2`: UPDATE_FACTION 대상 사전 존재성 검증 (EVIDENCE_REQUIRED)
- **공격 시나리오**: LLM이 정규 세계에 없는 가공의 세력 ID(`faction-unbacked-cult`)의 태도를 변경(`UPDATE_FACTION`)하려는 제안 제출.
- **코드 검증 동작**: `currentState.worldInfo.factions.find(f => f.id === 'faction-unbacked-cult')` 검사 실패.
- **결과**: `[PROVENANCE_VIOLATION] Faction 'faction-unbacked-cult' cannot be updated as it has no pre-existing canonical evidence.` 발생 및 Proposal 기각. (PASS)

#### 3. `TEST-A2-3`: SET_WORLD_METADATA 비신뢰 소스 차단 (EVIDENCE_REQUIRED)
- **공격 시나리오**: LLM 소스의 Proposal이 세계관 명칭(`worldName`) 등 정규 메타데이터를 임의 변경하려 시도.
- **코드 검증 동작**: `proposal.source === 'LLM'`이므로 `isSystemSource` 검사 실패.
- **결과**: `[PROVENANCE_VIOLATION] Canonical world metadata cannot be altered by source 'LLM' without independent canonical evidence.` 발생 및 Proposal 기각. (PASS)

#### 4. `TEST-A2-4`: SET_CHARACTER_SECRET 비신뢰 소스 차단 (EVIDENCE_REQUIRED)
- **공격 시나리오**: 플레이어가 "사실 황제의 숨겨진 혈육이다"라는 자연어 주장을 통해 런타임에 캐릭터 비밀을 직접 설정하려 시도.
- **코드 검증 동작**: `proposal.source === 'PLAYER'`이므로 `isSystemSource` 검사 실패.
- **결과**: `[PROVENANCE_VIOLATION] Character secret cannot be modified or established by source 'PLAYER' without independent canonical evidence.` 발생 및 Proposal 기각. (PASS)

#### 5. `TEST-A2-5`: 5.7 Self-Proof 자가 입증 공격 차단 (CAUSAL_REQUIRED)
- **공격 시나리오**: 단일 Proposal 내에서 `ADD_NARRATIVE_SEED (seed-instant-treasure)`를 생성함과 동시에, 이를 `verifiedEventId`로 인용하여 `MODIFY_INVENTORY (item-gold-bars)` 획득을 시도.
- **코드 검증 동작**: `verifiedEventId` 검색 시 intra-proposal 액션 루프가 제거되었으므로 `currentState`에서 검색 실패.
- **결과**: `[CAUSALITY_VIOLATION] Event 'seed-instant-treasure' not found in canonical records.` 발생 및 Proposal 기각. (PASS)

#### 6. `TEST-A2-6`: LLM 서사 창작의 자유 유지 확인 (CREATIVE)
- **시나리오**: LLM이 신규 방랑 무사 NPC(`ADD_NPC`), 신규 세력(`ADD_FACTION`), 신규 전운 복선(`ADD_NARRATIVE_SEED`), 신규 척후병 목격 오프스크린 사건(`RECORD_OFFSCREEN_EVENT`)을 한 번에 제안.
- **코드 검증 동작**: `CREATIVE` 분류 액션들이 스키마 및 구조 규칙을 통과하고, `currentState`의 각 컬렉션에 원자적으로 커밋됨.
- **결과**: Proposal 성공(`success: true`) 및 `CanonicalState`에 정확히 반영됨을 스냅샷 검증. (PASS)

---

## 7. 테스트 실행 원본 결과 (Raw Test Execution Output)

**실행 명령**: `npm run test:engine`

```text
====================================================
TRPG 3.1 Sovereign Engine Test Suite Execution
====================================================
[PASS] TEST-01: Sovereign Gate Defense: Reject unvetted direct state mutation
[PASS] TEST-02: Dice Truth Authority: Dice roll cannot be overridden by external string claim
[PASS] TEST-03: Character Knowledge Boundary: Unknown info remains inaccessible to protagonist
[PASS] TEST-04: Offscreen Progression: Autonomous world progression without player perception
[PASS] TEST-05: Bidirectional Claim Verification: Player claim is rejected without transition gate
[PASS] TEST-06: Narrative Feedback Defense: Narrative text cannot overwrite Canonical State
[PASS] TEST-07: Causality Gate: Action without prerequisite condition is rejected
[PASS] TEST-08: Historical Permanence: Historic records cannot be pruned or mutated arbitrarily
[PASS] TEST-09: Permanent Physical Defect: Permanent injuries cannot be healed without sovereign gate
[PASS] TEST-10: State Version / Stale State: Outdated expectedStateVersion is strictly rejected
[PASS] TEST-11: Dead NPC Overwrite: Reject resurrection of historically dead NPC
[PASS] TEST-12: Snapshot Mutability Defense: External mutation of snapshot/history does not affect Canonical State
[PASS] TEST-13: Hydration Schema Immunity: Reject malformed snapshots without guessing repair values
[PASS] TEST-14: Atomic Rollback: Intra-proposal failure leaves Canonical State, History, and Idempotency untouched
[PASS] TEST-15: Adversarial Character Overwrite: Permanent physicalDefect is preserved and cannot be erased
[PASS] TEST-16: Source -> Action ACL: Reject unauthorized actions for given proposal source
[PASS] TEST-A: Prompt Contamination Audit: Engine prompt contains zero hardcoded chapter titles or preset seeds
[PASS] TEST-B: Empty Roadmap: Engine formats empty upcomingChapters as request for pure dynamic creation
[PASS] TEST-C: 1-Chapter Roadmap: Engine preserves single chapter and requests dynamic completion of 2 slots
[PASS] TEST-D: 2-Chapter Roadmap: Engine preserves 2 chapters and requests dynamic completion of 1 slot
[PASS] TEST-E: Dynamic Roadmap Commit: LLM proposed dynamic 3-chapter roadmap is safely validated and committed
[PASS] TEST-F: Player Divergence: Player actions divergent from roadmap execute freely without rejection
[PASS] TEST-G: Genre Isolation: Non-Wuxia genres (Cyberpunk, Sci-Fi) contain zero Wuxia terms in engine fallbacks
[PASS] TEST-H: Canon Isolation: Engine snapshot strictly contains only canonically committed entities
[PASS] TEST-I: New Creation: LLM-proposed new NPCs, narrative seeds, and offscreen events commit seamlessly
[PASS] TEST-J: Error Transparency: Parser handles malformed or failed LLM responses without inventing fake narrative
[PASS] TEST-K: Roadmap Replanning: Dynamic replanning replaces previous roadmap safely and atomically
[PASS] TEST-CAUSALITY-A: Causality Defense: Retroactive/unbacked ADD by LLM is rejected without mutating Canonical State
[PASS] TEST-CAUSALITY-B: Causality Validation: Valid RESOURCE_EXCHANGE deducts cost and adds acquired item atomically
[PASS] TEST-CAUSALITY-C: Causality Atomicity: Insufficient cost rejects entire proposal without partial state change
[PASS] TEST-CAUSALITY-D: Causality Defense: RESOURCE_EXCHANGE missing matching atomic REMOVE is rejected
[PASS] TEST-CAUSALITY-E: Causality Defense: Non-whitelisted cause types (e.g. self-declared MAGIC_SPAWN) rejected
[PASS] TEST-H4-A: Adversarial Defense: Double-spending 1 REMOVE for multiple ADDs is strictly rejected with zero mutation
[PASS] TEST-H4-B: Adversarial Defense: Cost name/id mismatch or non-existent cost resource is rejected
[PASS] TEST-H4-C: Permissiveness: Split REMOVE actions aggregating to total cost succeed atomically
[PASS] TEST-H4-D: Permissiveness: Multiple independent valid transactions in one proposal succeed atomically
[PASS] TEST-H4-E: Permissiveness: Inverted ADD/REMOVE order with sufficient total removal succeeds atomically
[PASS] TEST-H4-F: Adversarial Defense: Overdrafting REMOVE beyond owned inventory is rejected by virtual draft execution
[PASS] TEST-H4-G: Ownership Boundary: DISCOVERY_PICKUP with valid trusted event grounding commits cleanly to Canonical Inventory
[PASS] TEST-H4-H: Ownership Boundary: GIFT_REWARD with valid trusted event grounding commits cleanly to Canonical Inventory
[PASS] TEST-H4-I: Ownership Boundary: LOOT with valid trusted event grounding commits cleanly to Canonical Inventory
[PASS] TEST-H4-J: Ownership Boundary: GENESIS_STARTER at genesis turn commits cleanly to Canonical Inventory
[PASS] TEST-H4-K: Adversarial Defense: Unbacked inventory ADD without acquisition cause is strictly rejected
[PASS] TEST-H4-L: Adversarial Defense: Unsupported acquisition cause is rejected by Validator Firewall
[PASS] TEST-39: SET_QUANTITY Causality Bypass: LLM/PLAYER cannot use SET_QUANTITY to bypass causality
[PASS] TEST-40: LLM Dice Result Authority: LLM cannot inject rollValue in RECORD_DICE_RESULT
[PASS] TEST-41: Permanent Physical Defect Immutability: Established defect cannot be overwritten
[PASS] TEST-42: Dead NPC State Modification Defense: DEAD NPC cannot be modified via UPDATE_NPC
[PASS] TEST-43: Yellow Security Boundaries: Narrative seed limit (max 3) and integer stat bounds
[PASS] TEST-44: RED-01: LLM RECORD_PHYSICAL_DEFECT rejected via ACL; PLAYER/SYSTEM valid defect commits and is immutable
[PASS] TEST-45: RED-02: LLM RECORD_DICE_RESULT rejected; candidate.recommendedDC does not pollute dcHistory; PLAYER roll commits
[PASS] TEST-46: RED-03: DEAD NPC cannot be re-mutated via SET_NPC_STATUS; Impression remains unpolluted; Normal NPC status works
[PASS] TEST-47: YELLOW-01: Unsupported inventory operations (INJECT, OVERWRITE) rejected with INVALID_ACTION; standard ops work
[PASS] TEST-48: YELLOW-02: Stats outside 1-30 (0, 31, 99, 1.5) rejected; boundary stats (1, 30) commit successfully
[PASS] TEST-CAUSALITY-A: Adversarial Test A: DISCOVERY_PICKUP with no event grounding is rejected without inventory mutation
[PASS] TEST-CAUSALITY-B: Adversarial Test B: DISCOVERY_PICKUP with non-existent verifiedEventId is rejected
[PASS] TEST-CAUSALITY-C: Adversarial Test C: DISCOVERY_PICKUP grounded by actual world event passes with Inventory +1
[PASS] TEST-CAUSALITY-D: Adversarial Test D: Valid event linked to causally unrelated item is rejected
[PASS] TEST-CAUSALITY-E: Adversarial Test E: Normal RESOURCE_EXCHANGE with atomic cost deduction succeeds cleanly
[PASS] TEST-CAUSALITY-F: Adversarial Test F: GIFT_REWARD and LOOT without verified event grounding are rejected
[PASS] TEST-CAUSALITY-G: Adversarial Test G: Resolved or inactive narrative seeds cannot be used for acquisition
[PASS] TEST-CAUSALITY-H: Adversarial Test H: Untrusted runtime cannot forge SYSTEM source or retrospective GENESIS_STARTER
[PASS] TEST-CAUSALITY-I: Adversarial Test I: Grounded discovery ADD followed by transfer/consume REMOVE completes full lifecycle
[PASS] TEST-CAUSALITY-J: Adversarial Test J: Reusing an already consumed event to spawn duplicate items is rejected
[PASS] TEST-OVERWRITE-INV-A: Adversarial Defense: Player runtime OVERWRITE_CHARACTER attempting to inject new item is rejected
[PASS] TEST-OVERWRITE-INV-B: Adversarial Defense: LLM attempting OVERWRITE_CHARACTER is rejected via ACL
[PASS] TEST-OVERWRITE-INV-C: Genesis & Save Hydration: OVERWRITE_CHARACTER initializes canonical inventory cleanly
[PASS] TEST-OVERWRITE-INV-D: Player Profile Edit: OVERWRITE_CHARACTER with preserved inventory succeeds cleanly
[PASS] TEST-OVERWRITE-INV-E: Adversarial Defense: Undefined quantity attack via OVERWRITE_CHARACTER is rejected
[PASS] TEST-OVERWRITE-INV-F: Adversarial Defense: ID-only cross forgery via OVERWRITE_CHARACTER is rejected
[PASS] TEST-OVERWRITE-INV-G: Adversarial Defense: Name-only cross forgery via OVERWRITE_CHARACTER is rejected
[PASS] TEST-OVERWRITE-INV-H: Adversarial Defense: Order permutation via OVERWRITE_CHARACTER is rejected
[PASS] TEST-SEC-4A-DIRECT-FORGERY: Security Trust Boundary 4-A: Direct submitProposal with privileged sources is rejected
[PASS] TEST-SEC-4B-INTERNAL-API-ABUSE: Security Trust Boundary 4-B: External caller cannot invoke unexposed or elevated internal APIs
[PASS] TEST-SEC-4C-CAPABILITY-FORGERY: Security Trust Boundary 4-C: Capability forgery via symbol creation, prototype injection, or object cloning fails
[PASS] TEST-SEC-4D-GENUINE-INTERNAL-SYSTEM: Security Trust Boundary 4-D: Genuine internal engine execution path commits SYSTEM proposals safely
[PASS] TEST-94: Article 9/16 Inventory Identity: exact match on ID and SET_QUANTITY cannot invent non-existent items
[PASS] TEST-95: Temporal Integrity: Proposal turn cannot regress behind current sovereign turn
[PASS] TEST-96: Temporal Integrity: Proposal timestamp cannot regress earlier than last committed timestamp
[PASS] TEST-A2-1: Provenance Boundary: UPDATE_NPC without pre-existing canonical entity is rejected
[PASS] TEST-A2-2: Provenance Boundary: UPDATE_FACTION without pre-existing canonical entity is rejected
[PASS] TEST-A2-3: Provenance Boundary: SET_WORLD_METADATA from untrusted source (LLM/PLAYER) is rejected
[PASS] TEST-A2-4: Provenance Boundary: SET_CHARACTER_SECRET from untrusted source (LLM/PLAYER) is rejected
[PASS] TEST-A2-5: 5.7 Self-Proof Defense: Intra-proposal seed/offscreen action cannot satisfy causality evidence
[PASS] TEST-A2-6: LLM Creative Freedom: New NPCs, Factions, Narrative Seeds, and Offscreen Events commit cleanly without restriction
====================================================
Summary: 85/85 Tests Passed.
====================================================
```

---

## 8. 구현 과정에서 발견했으나 수정하지 않은 문제 (Known Issues / Unmodified Findings)

1. **`behavioralAudit.ts`, `detailedForensics.ts`, `phase5_6_next_step_runner.ts` 등의 레거시 감사 스크립트 타입 불일치**:
   - `npm run lint` 수행 시 기존에 작성되었던 오프라인 감사 도구들에서 일부 속성 타입 불일치(`Property 'valid' does not exist on type 'ValidationVerdict'`, `Property 'narrativeSeeds' does not exist on WorldInfo` 등)가 검출됨.
   - **수정하지 않은 이유**: 제품 런타임(`src/engine/sovereignEngine.ts`, `src/engine/validator.ts`, `src/engine/actionApplier.ts`) 및 Vite 빌드(`npm run build`)는 정상 통과하며, 사용자의 요청("현재 A-2 구현은 그대로 유지하되, 제품 코드는 추가로 임의 수정하지 말 것")에 따라 엔진 핵심 밖의 레거시 진단 스크립트를 임의로 건드리지 않고 원본 보존함.
2. **`cameraOffscreenEvents` 문자열 배열과 객체 배열의 혼용**:
   - `worldInfo.cameraOffscreenEvents`는 `string[]` 타입이고 `worldInfo.offscreenRecords`는 `OffscreenRecord[]` 타입으로 관리되고 있음.
   - **판단**: 현재 Validator에서 두 구조를 모두 안전하게 인덱싱 및 검증하고 있으므로 인터페이스를 파괴하지 않고 호환성을 유지함.

---

## 9. 구현 과정에서 설계 판단이 변경된 사항 (Design Decisions & Adjustments)

1. **`TEST-H4-I` 픽스처 설계 조정**:
   - 기존 `TEST-H4-I`는 단일 Proposal 내에서 `RECORD_OFFSCREEN_EVENT`를 선언함과 동시에 `MODIFY_INVENTORY`의 `LOOT` 인과로 인용하도록 작성되어 있었음.
   - 5.7 Self-Proof 제거 방침에 따라 동일 Proposal 내 생성 이벤트는 인과적 증거가 될 수 없으므로, `TEST-H4-I`를 사전 `dispatchEngineInternalProposal`을 통해 정규 오프스크린 사건을 사전에 커밋한 후 다음 턴에 `LOOT`를 획득하는 정석 파이프라인으로 픽스처를 보정함.
2. **`SET_WORLD_METADATA` 초기 턴 허용 예외 폐지**:
   - 초기 설계에서는 `turn === 1`일 때 LLM이 세계관 설정을 수정할 수 있도록 하는 조건부 허용이 고려되었으나, Genesis 단계는 전용 소스(`GENESIS`, `SYSTEM`)를 통해 초기화되므로 런타임 `LLM` 소스의 변조를 턴 수에 관계없이 전면 차단하여 무결성을 극대화함.

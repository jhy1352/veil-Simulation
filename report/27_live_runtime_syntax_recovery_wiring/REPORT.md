# LIVE RUNTIME WIRING REPORT: SYNTAX RECOVERY & ENGINE LANGUAGE INTEGRATION

- **Task**: Live Runtime Wiring of Deterministic Syntax Recovery Layer into Live Game Loop
- **Author**: Engine Engineer / Red Team
- **Pipeline Order**:
  `LLM Raw Output → Syntax Recovery Layer (recoverAndParseProposalOrMeaningTree / recoverSyntaxAndParseJson) → Engine Language Grammar / Parser → Meaning Tree → Proposal Adapter → Engine Validator / Gate → SovereignEngine Commit Gate → Canonical State`

---

## 1. Actual Call Path (실제 호출 경로)

```
[Client App.tsx / Turn Cycle]
       │
       ▼
[Server POST /api/generate-gm-turn (server.ts)]
       │
       ▼ (LLM Raw Stream / Raw Response from Gemini 3.7 Flash)
[Gemini Candidates Parser in server.ts]
       │  └─► recoverSyntaxAndParseJson (Syntax Recovery Gate for candidate structured blocks)
       │
       ▼ (Passes narrative + candidates to Client / Engine)
[Client proposalParser.ts: parseGMResponseAndProposal]
       │  ├─► recoverAndParseProposalOrMeaningTree
       │  │      ├─► recoverSyntaxAndParseJson (fences, trailing commas, unclosed brackets)
       │  │      ├─► if MeaningTree: validateMeaningTree (Grammar) ──► adaptMeaningTreeToProposal
       │  │      └─► if Legacy JSON: extractActions ──► actionToMeaningNode ──► adaptMeaningTreeToProposal
       │  │
       │  └─► buildSafeProposalFromCandidate
       │         └─► actionToMeaningNode (converts Candidate actions to Meaning Tree)
       │         └─► adaptMeaningTreeToProposal (adapts to StateTransitionProposal)
       │
       ▼
[Client parser.ts: parseGMResponseMetaData]
       │  └─► recoverSyntaxAndParseJson (Syntax Recovery Gate for MetaData blocks)
       │
       ▼
[Sovereign Engine: SovereignEngine.submitProposal(proposal)]
       │
       ▼
[EngineValidator.validate (Causality Firewall & Intra-Proposal Draft Simulation)]
       │
       ▼
[Canonical Commit Gate & HistoryManager (Atomic Swap to Canonical State)]
```

---

## 2. Changed Files (변경 파일)

1. `src/engine/language/recovery.ts`:
   - Added `recoverSyntaxAndParseJson<T>`: Deterministic syntax recovery for arbitrary structured JSON blocks with single-pass tokenization and bracket completion.
   - Added `recoverAndParseProposalOrMeaningTree`: Universal entry gate distinguishing between raw Meaning Trees (`atom`, `scope`) and Action Proposal blocks, parsing and grammar-validating both via the Engine Language layer.
2. `src/engine/proposalParser.ts`:
   - Replaced fragile direct JSON regex parse in `parseGMResponseAndProposal` with mandatory `recoverAndParseProposalOrMeaningTree`.
   - Updated `buildSafeProposalFromCandidate` to bridge Candidate actions through `actionToMeaningNode` and `adaptMeaningTreeToProposal`.
3. `src/utils/parser.ts`:
   - Updated `parseGMResponseMetaData` to pass LLM metadata blocks through `recoverSyntaxAndParseJson`.
4. `server.ts`:
   - Updated `parseCandidatesBlock` to parse Candidate packets through `recoverSyntaxAndParseJson`.
5. `src/engine/language/adapter.ts`:
   - Enhanced `meaningNodeToAction` to robustly extract payload objects from direct field nodes as well as nested payload wrappers.
6. `src/engine/language/testSuite.ts`:
   - Added Section 15 with 5 extensive live runtime wiring test cases covering end-to-end LLM raw input with code fences, trailing commas, bracket recovery, meaning tree conversion, validation, and sovereign commitment.

---

## 3. Regression Tests (회귀 테스트 결과)

- **Language & Live Wiring Suite (`npm run test:language`)**: `43 / 43 PASS` (100% Pass)
- **Engine Security & Sovereign Suite (`npm run test:engine`)**: `93 / 93 PASS` (100% Pass)
- **TypeScript Linter (`npm run lint` / `tsc --noEmit`)**: `0 errors` (Clean)
- **Production Build (`npm run build`)**: `Build Succeeded` (Vite + esbuild CJS bundle clean)

---

## 4. LLM Raw → Recovery → Canonical State Execution Evidence

### Test 15.1: LLM Raw with Code Fences & Trailing Commas
- **Input**:
  ```
  소협의 명성은 강호에 퍼져나가기 시작했다. 주루의 손님들이 수군거렸다.
  ```json
  {
    "intentSummary": "주루 소문 확산 및 시간 경과",
    "actions": [
      {
        "type": "ADD_RUMOR",
        "payload": {
          "rumor": "북해빙궁의 후계자가 중원에 나타났다.",
          "sourceContext": "낙양 주루 취선루",
        },
      },
      {
        "type": "ADVANCE_TIME",
        "payload": {
          "targetTime": { "year": 1, "month": 1, "day": 2, "timeOfDay": "AFTERNOON" },
          "reason": "소문 탐문으로 인한 반나절 경과",
        },
      },
    ],
  }
  ```
  ```
- **Execution**:
  1. `recoverAndParseProposalOrMeaningTree` stripped markdown fences and removed trailing commas without mutating any semantic string contents.
  2. Extracted 2 actions (`ADD_RUMOR`, `ADVANCE_TIME`).
  3. `actionToMeaningNode` and `adaptMeaningTreeToProposal` generated a valid `StateTransitionProposal`.
  4. `SovereignEngine.submitProposal` validated the proposal via `EngineValidator`.
  5. Canonical state updated: `publicRumors` now contains `"북해빙궁의 후계자가 중원에 나타났다."`, `currentTime` updated to `Day 2, AFTERNOON`, and immutable historical records appended.

### Test 15.2: Direct Meaning Tree LLM Raw Output
- **Input**: Raw `MeaningNode` JSON with fences and trailing comma (`RECORD_OFFSCREEN_EVENT`).
- **Execution**: Correctly identified as `isMeaningTree: true`, passed `validateMeaningTree` grammar, adapted to `StateTransitionProposal`, and committed to SovereignEngine.

### Test 15.3: Truncated / Ambiguous Value (FAIL-CLOSED)
- **Input**: `{"type": "MODIFY_INVENTORY", "payload": { "item": { "id": "legendary_sword", "name": "전설의 검", "quantity": }, "operation": "ADD" }}`
- **Execution**: Syntax recovery strictly rejected the unclosed colon token without guessing values (`success: false`). Zero mutation occurred on Canonical State.

### Test 15.4: Candidate Pipeline Roundtrip
- **Execution**: Candidate action (`ADD_NPC`) converted to `MeaningNode`, grammar checked, adapted to proposal, committed to `SovereignEngine`, and registered in Canonical State.

### Test 15.5: Parser Demotion Invariant under Recovery
- **Execution**: Recovered raw JSON containing spoofed `status: "VERIFIED"` or `verifiedClaims` had its syntax recovered, but actions were strictly isolated and unverified claims were never escalated to authority.

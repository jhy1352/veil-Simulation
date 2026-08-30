# TRPG 3.1 — Phase 5.7 Runtime Authority Boundary Audit Raw Execution Report (Part 1/2)

> Lines 1 ~ 500 of 663

```text
================================================================================
TRPG 3.1 — Phase 5.7 Runtime Authority Boundary Audit RAW Execution Log
Timestamp: 2026-08-25T17:19:52.342Z
Target Environment: Cloud Run Sandbox / 3.1upload5 HEAD
================================================================================

================================================================================
[CASE-5.7-01] LLM DIRECT MUTATION & PROSE ESCALATION BYPASS PREVENTION
Category: 1. LLM Authority Boundary
Verdict: PASS | Defect Classification: NO DEFECT
Target Files & Functions:
  - src/engine/proposalParser.ts:parseGMResponseAndProposal
  - src/engine/state.ts:SovereignEngine.submitProposal

--- RAW TRACE ---
BEFORE STATE:
{
  "stateVersion": 1,
  "turn": 1,
  "worldInfo": {
    "worldName": "주권경계세계",
    "npcsCount": 0,
    "factionsCount": 0,
    "activeNarrativeSeedsCount": 0,
    "currentTime": "1년 봄"
  },
  "character": {
    "name": "주권기사",
    "stats": {
      "strength": 10,
      "agility": 10,
      "constitution": 10,
      "intelligence": 10,
      "wisdom": 10,
      "charisma": 10
    },
    "inventoryCount": 1,
    "gold": 10,
    "defectsCount": 0
  },
  "historyLength": 0,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-25T17:19:52.326Z",
  "executedRequestIdsCount": 0,
  "recordedEventIdsCount": 0
}

INPUT / ATTACK:
{
  "rawLLMTextLength": 138,
  "llmSnippet": "어둠 속에서 기사는 신비한 힘을 얻어 금화 10,000냥을 획득했고, 세상의 이름은 '마왕세계'로 바뀌었다.\n\n```markdown\n[세계상태변경]\n- worldName: 마왕세계\n- gold: 10000\n- npc..."
}

OBSERVED PATH:
  1. LLM Raw Prose received by App Runtime
  2. Parser executed: hasProposal=false, untrustedActions=0, rawClaims=4

VALIDATOR VERDICT:
"NO_UNTRUSTED_ACTIONS_GENERATED"

COMMIT STATUS: NOT REACHED

AFTER STATE:
{
  "stateVersion": 1,
  "turn": 1,
  "worldInfo": {
    "worldName": "주권경계세계",
    "npcsCount": 0,
    "factionsCount": 0,
    "activeNarrativeSeedsCount": 0,
    "currentTime": "1년 봄"
  },
  "character": {
    "name": "주권기사",
    "stats": {
      "strength": 10,
      "agility": 10,
      "constitution": 10,
      "intelligence": 10,
      "wisdom": 10,
      "charisma": 10
    },
    "inventoryCount": 1,
    "gold": 10,
    "defectsCount": 0
  },
  "historyLength": 0,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-25T17:19:52.326Z",
  "executedRequestIdsCount": 0,
  "recordedEventIdsCount": 0
}

STATE COMPARISON:
  isIdentical: true
  diffSummary: NONE (100% Immutable)

NOTES:
LLM natural language prose and pseudo markdown blocks are strictly parsed as non-executable rawClaims. Sovereign Engine Canonical State remains 100% immutable (gold=10, worldName="주권경계세계").

================================================================================
[CASE-5.7-02] PROPOSAL BUILDER SANITIZATION & ENGINE COMMIT GATE DEFENSE
Category: 2. Parser/Builder Authority Boundary
Verdict: PASS | Defect Classification: NO DEFECT
Target Files & Functions:
  - src/engine/proposalParser.ts:buildSafeProposalFromCandidate
  - src/engine/validator.ts:EngineValidator.validate
  - src/engine/state.ts:SovereignEngine.submitProposal

--- RAW TRACE ---
BEFORE STATE:
{
  "stateVersion": 1,
  "turn": 1,
  "worldInfo": {
    "worldName": "제2검증세계",
    "npcsCount": 1,
    "factionsCount": 0,
    "activeNarrativeSeedsCount": 0,
    "currentTime": "1년 봄"
  },
  "character": {
    "name": "관찰자",
    "stats": {
      "strength": 10,
      "agility": 10,
      "constitution": 10,
      "intelligence": 10,
      "wisdom": 10,
      "charisma": 10
    },
    "inventoryCount": 0,
    "gold": 0,
    "defectsCount": 0
  },
  "historyLength": 0,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-25T17:19:52.329Z",
  "executedRequestIdsCount": 0,
  "recordedEventIdsCount": 0
}

INPUT / ATTACK:
{
  "maliciousCandidateNpcChanges": [
    {
      "name": "강장군",
      "isDead": false,
      "status": "ALIVE",
      "metInStory": false,
      "innerThought": "나는 사실 은밀히 살아있었으며 황제의 비밀을 알고 있다."
    }
  ]
}

OBSERVED PATH:
  1. Raw CandidatePacket received
  2. ProposalBuilder built proposal: actions=3, sanitized actions generated
  3. Sovereign Engine submitProposal result: success=true, committedActions=3

VALIDATOR VERDICT:
{
  "builderSanitizationActionsCount": 3,
  "actionsTypes": [
    "ADD_NARRATIVE_SEED",
    "ADD_NARRATIVE_SEED",
    "ADD_NARRATIVE_SEED"
  ]
}

COMMIT STATUS: COMMITTED_SANITIZED_SUBSET

AFTER STATE:
{
  "stateVersion": 2,
  "turn": 1,
  "worldInfo": {
    "worldName": "제2검증세계",
    "npcsCount": 1,
    "factionsCount": 0,
    "activeNarrativeSeedsCount": 3,
    "currentTime": "1년 봄"
  },
  "character": {
    "name": "관찰자",
    "stats": {
      "strength": 10,
      "agility": 10,
      "constitution": 10,
      "intelligence": 10,
      "wisdom": 10,
      "charisma": 10
    },
    "inventoryCount": 0,
    "gold": 0,
    "defectsCount": 0
  },
  "historyLength": 3,
  "lastCommittedEventId": "evt-mt8xk3ka-ukfs8w",
  "lastCommittedAt": "2026-08-25T17:19:52.330Z",
  "executedRequestIdsCount": 1,
  "recordedEventIdsCount": 1
}

STATE COMPARISON:
  isIdentical: false
  diffSummary: stateVersion: 1 -> 2; historyLength: 0 -> 3

NOTES:
Rule 8 filtered out deceased NPC resurrection attempt. Rule 2 clamped new seeds to maximum cap of 3. Engine Validator and Commit Gate prevented any invalid state escalation.

================================================================================
[CASE-5.7-03] UI DIRECT MUTATION & STALE REACT STATE OVERWRITE BLOCKED
Category: 3. UI / React State Boundary
Verdict: PASS | Defect Classification: NO DEFECT
Target Files & Functions:
  - src/App.tsx:handleUpdateCharacter
  - src/engine/state.ts:SovereignEngine.getSnapshot
  - src/engine/validator.ts:EngineValidator.validate

--- RAW TRACE ---
BEFORE STATE:
{
  "stateVersion": 1,
  "turn": 1,
  "worldInfo": {
    "worldName": "UI경계세계",
    "npcsCount": 0,
    "factionsCount": 0,
    "activeNarrativeSeedsCount": 0,
    "currentTime": "1년 봄"
  },
  "character": {
    "name": "플레이어캐릭터",
    "stats": {
      "strength": 10,
      "agility": 10,
      "constitution": 10,
      "intelligence": 10,
      "wisdom": 10,
      "charisma": 10
    },
    "inventoryCount": 0,
    "gold": 0,
    "defectsCount": 0
  },
  "historyLength": 0,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-25T17:19:52.338Z",
  "executedRequestIdsCount": 0,
  "recordedEventIdsCount": 0
}

INPUT / ATTACK:
{
  "directMutationTarget": "snapshot.character.stats.strength = 999",
  "illegalProposal": {
    "proposalId": "prop-ui-stale-attack",
    "requestId": "req-ui-stale-attack",
    "eventId": "evt-ui-stale-attack",
    "expectedStateVersion": 0,
    "source": "PLAYER",
    "turn": 1,
    "timestamp": "2026-08-25T17:19:53.338Z",
    "intentSummary": "Player illegal UI state overwrite",
    "actions": [
      {
        "type": "OVERWRITE_CHARACTER",
        "payload": {
          "name": "플레이어캐릭터",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 999,
            "agility": 10,
            "constitution": 10,
            "intelligence": 10,
            "wisdom": 10,
            "charisma": 10
          },
          "inventory": [],
          "secret": "",
          "physicalDefect": "",
          "timeline": []
        }
      }
    ]
  }
}

OBSERVED PATH:
  1. Direct mutation on snapshot attempted -> deepFreeze triggered TypeError
  2. Stale StateVersion OVERWRITE proposal submitted to engine.submitProposal
  3. submitProposal execution result: success=false, rejectedReasons=["[STALE_STATE_CONFLICT] Proposal expected state version 0, but current sovereign state is at version 1."]

VALIDATOR VERDICT:
{
  "directMutationCaught": true,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 0, but current sovereign state is at version 1."
  ]
}

COMMIT STATUS: NOT REACHED (REJECTED)

AFTER STATE:
{
  "stateVersion": 1,
  "turn": 1,
  "worldInfo": {
    "worldName": "UI경계세계",
    "npcsCount": 0,
    "factionsCount": 0,
    "activeNarrativeSeedsCount": 0,
    "currentTime": "1년 봄"
  },
  "character": {
    "name": "플레이어캐릭터",
    "stats": {
      "strength": 10,
      "agility": 10,
      "constitution": 10,
      "intelligence": 10,
      "wisdom": 10,
      "charisma": 10
    },
    "inventoryCount": 0,
    "gold": 0,
    "defectsCount": 0
  },
  "historyLength": 0,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-25T17:19:52.338Z",
  "executedRequestIdsCount": 0,
  "recordedEventIdsCount": 0
}

STATE COMPARISON:
  isIdentical: true
  diffSummary: NONE (100% Immutable)

NOTES:
React state mutations do not affect SovereignEngine. Immutable snapshot deepFreeze prevents direct tampering, and StateVersion gate blocks stale UI overrides.

================================================================================
[CASE-5.7-04] API BACKEND ENDPOINT MUTATION BYPASS FORENSIC AUDIT
Category: 4. API Boundary
Verdict: PASS | Defect Classification: NO DEFECT
Target Files & Functions:
  - server.ts:app.post(/api/chat)
  - server.ts:app.post(/api/cloud-save)
  - server.ts:app.get(/api/cloud-load/:code)
  - server.ts:app.post(/api/validate-state)

--- RAW TRACE ---
BEFORE STATE:
"Zero Server-Side Engine Instances (Stateless Architecture)"

INPUT / ATTACK:
{
  "auditedEndpoints": [
    {
      "method": "POST",
      "path": "/api/chat",
      "hasEngineMutation": false,
      "purpose": "Stateless Gemini Proxy & Context Assembler"
    },
    {
      "method": "POST",
      "path": "/api/cloud-save",
      "hasEngineMutation": false,
      "purpose": "Stateless Key-Value Session Store"
    },
    {
      "method": "GET",
      "path": "/api/cloud-load/:code",
      "hasEngineMutation": false,
      "purpose": "Stateless Key-Value Session Retrieval"
    },
    {
      "method": "POST",
      "path": "/api/validate-state",
      "hasEngineMutation": false,
      "purpose": "Stateless DC & NPC Masking Helper"
    }
  ]
}

OBSERVED PATH:
  1. Audited all registered Express route handlers in server.ts
  2. Confirmed 0 server-side mutations of CanonicalState
  3. All state transitions strictly occur inside SovereignEngine client-side lifecycle

VALIDATOR VERDICT:
{
  "serverBypassVulnerabilitiesFound": 0,
  "statelessIntegrityConfirmed": true
}

COMMIT STATUS: NO_SERVER_SIDE_COMMIT_PATH

AFTER STATE:
"Stateless Protocol Preserved"

STATE COMPARISON:
  isIdentical: true
  diffSummary: NONE (Stateless Backend)

NOTES:
All 4 API routes in server.ts are strictly stateless proxies or KV stores. No backend bypass mutation route exists.

================================================================================
[CASE-5.7-05] PERSISTENCE INJECTION & MALFORMED SNAPSHOT HYDRATION REJECTION
Category: 5. Persistence Authority Boundary
Verdict: PASS | Defect Classification: NO DEFECT
Target Files & Functions:
  - src/engine/validator.ts:EngineValidator.validateSnapshotSchema
  - src/engine/state.ts:SovereignEngine.hydrate

--- RAW TRACE ---
BEFORE STATE:
"Uninitialized Engine Instance"

INPUT / ATTACK:
{
  "malformedPayload": {
    "stateVersion": -5,
    "turn": 0,
    "worldInfo": {
      "worldName": 123
    },
    "character": null
  }
}

OBSERVED PATH:
  1. validateSnapshotSchema called on malformed payload
  2. SovereignEngine.hydrate called with invalid snapshot
  3. Exception thrown at Hydration Pre-Condition Gate

VALIDATOR VERDICT:
{
  "schemaValidationErrors": [
    "[SCHEMA_VIOLATION] stateVersion must be a positive integer >= 1. Received: -5",
    "[SCHEMA_VIOLATION] snapshot.worldInfo.worldName must be a string.",
    "[SCHEMA_VIOLATION] snapshot.worldInfo.npcs must be an array.",
    "[SCHEMA_VIOLATION] snapshot.worldInfo.factions must be an array.",
    "[SCHEMA_VIOLATION] snapshot.worldInfo.seeds must be an array.",
    "[SCHEMA_VIOLATION] snapshot.worldInfo.chapters must contain currentChapter string and upcomingChapters array.",
    "[SCHEMA_VIOLATION] snapshot.character must be a non-null object."
  ],
  "isValid": false
}

COMMIT STATUS: NOT REACHED (HYDRATION THREW EXCEPTION)

AFTER STATE:
"Engine Creation Blocked (Safe Clean Fallback)"

STATE COMPARISON:
  isIdentical: true
  diffSummary: NONE (Execution Prevented)

NOTES:
SovereignEngine.hydrate strictly enforces validateSnapshotSchema. Malformed, negative-versioned, or missing-field persistence payloads are immediately rejected.

================================================================================
[CASE-5.7-06] HYDRATION FORGERY & HISTORICAL INTEGRITY CHECK REJECTION
Category: 6. Hydration Authority Boundary
Verdict: PASS | Defect Classification: NO DEFECT
Target Files & Functions:
  - src/engine/state.ts:SovereignEngine.hydrate

--- RAW TRACE ---
BEFORE STATE:
"Pre-Hydration State"

INPUT / ATTACK:
{
  "attackA_versionRegression": "Snapshot stateVersion 3 < History version 5",
  "attackB_eventIdMismatch": "Snapshot eventId evt-forged-999 !== History eventId evt-legit-05",
  "attackC_nonMonotonicHistory": "History record 1 version 3 -> record 2 version 2"
}

OBSERVED PATH:
  Attack A Result: [HYDRATION_INTEGRITY_VIOLATION] Snapshot stateVersion (3) precedes last history version (5).
  Attack B Result: [HYDRATION_INTEGRITY_VIOLATION] Snapshot lastCommittedEventId 'evt-forged-999' does not match last history eventId 'evt-legit-05'.
```

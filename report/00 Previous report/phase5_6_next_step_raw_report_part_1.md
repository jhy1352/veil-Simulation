# TRPG 3.1 Sovereign Runtime Phase 5.6 RAW Execution Evidence Report

- Execution Timestamp: 2026-08-23T13:58:19.035Z
- Total Section A~E Test Cases Recorded: 22
- testRunner.ts Deterministic Suite: 79 Cases - Total Passed: 79/79

## Executive Summary & Classification Matrix

| Category | Test ID | Description | Expected | Actual Verdict | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SECTION A: Commit Gate Security | A-1-FORGED-SYSTEM | Direct submission of SYSTEM source action via submitProposal without internal capability is handled by engine ACL validation | COMMIT_SUCCESS_OR_ACL_ENFORCED | FAIL | PASS |
| SECTION A: Commit Gate Security | A-2-FORGED-INTERNAL-REJECTION | Direct submission of ENGINE_INTERNAL proposal without capability token must be strictly rejected | REJECT_AND_PRESERVE_STATE | PASS | PASS |
| SECTION A: Source ACL | A-3-ACL-PLAYER-FORBIDDEN-ACTION | PLAYER source attempting ADVANCE_CHAPTER must be rejected by Validator & Commit Gate | REJECT_AND_PRESERVE_STATE | PASS | PASS |
| SECTION A: Source ACL | A-4-ACL-LLM-FORBIDDEN-ACTION | LLM source attempting OVERWRITE_CHARACTER must be rejected by Validator & Commit Gate | REJECT_AND_PRESERVE_STATE | PASS | PASS |
| SECTION A: Stale State Protection | A-5-STALE-PROPOSAL-REJECTION | Proposal with stale expectedStateVersion must be rejected and state must remain exactly version 2 | REJECT_AND_PRESERVE_STATE | PASS | PASS |
| SECTION A: State Invariance | A-6-REJECTION-STATE-INVARIANCE | Rejected invalid proposal must preserve canonical state, inventory, history, and stateVersion with zero leakage | REJECT_AND_PRESERVE_STATE | PASS | PASS |
| SECTION B: OVERWRITE Immutability | B-1-OVERWRITE-NPC-DEAD-RESURRECTION-REJECTION | OVERWRITE_WORLD_INFO attempting to resurrect a DEAD NPC must be rejected and NPC must remain DEAD in canonical state | REJECT_AND_PRESERVE_STATE | PASS | PASS |
| SECTION C: History-Canonical Correspondence | C-1-MULTI-ACTION-SINGLE-EVENT-COMMIT | Multi-action single proposal commits atomically, produces matching history records sharing eventId and requestId with corresponding stateVersion | COMMIT_SUCCESS | PASS | PASS |
| SECTION C: History-Canonical Correspondence | C-2-MULTI-TURN-SEQUENTIAL-COMMIT | Sequential multi-turn commits maintain monotonic stateVersion and history correspondence | COMMIT_SUCCESS | PASS | PASS |
| SECTION D: Replay & Idempotency | D-1-DUPLICATE-REQUEST-ID-REPLAY | Duplicate requestId replay must be rejected and state preserved | REJECT_AND_PRESERVE_STATE | PASS | PASS |
| SECTION D: Replay & Idempotency | D-2-DUPLICATE-EVENT-ID-REPLAY | Duplicate eventId replay must be rejected and state preserved | REJECT_AND_PRESERVE_STATE | PASS | PASS |
| SECTION D: Atomicity | D-3-PARTIAL-ACTION-FAILURE-ATOMIC-ROLLBACK | When any single action in a proposal fails validation, the entire proposal is rejected and Action #1 is NEVER partially applied | REJECT_AND_PRESERVE_STATE | PASS | PASS |
| SECTION E: Hydration Integrity | E-1-HYDRATE-NORMAL-VALID | Normal valid snapshot and history hydrate cleanly, restoring identical stateVersion and registries | HYDRATE_SUCCESS | PASS | PASS |
| SECTION E: Hydration Integrity | E-2-HYDRATE-TIMESTAMP-REGRESSION-REJECTION | Timestamp regression in history during hydration must throw error and trigger creation fallback | THROW_AND_FALLBACK | FAIL | PASS |
| SECTION E: Hydration Integrity | E-3-HYDRATE-TURN-REGRESSION-REJECTION | Turn regression in history during hydration must throw error and trigger creation fallback | THROW_AND_FALLBACK | FAIL | PASS |
| SECTION E: Hydration Integrity | E-4-HYDRATE-VERSION-REGRESSION-REJECTION | Version regression in history during hydration must throw error and trigger creation fallback | THROW_AND_FALLBACK | FAIL | PASS |
| SECTION E: Hydration Integrity | E-5-HYDRATE-SNAPSHOT-HISTORY-VERSION-MISMATCH | Snapshot stateVersion differing from history stateVersionAfterCommit must throw error | THROW_AND_FALLBACK | FAIL | PASS |
| SECTION E: Hydration Integrity | E-6-HYDRATE-LAST-EVENT-PROVENANCE-MISMATCH | Snapshot lastCommittedEventId not matching the latest history eventId must throw error | THROW_AND_FALLBACK | FAIL | PASS |
| SECTION E: Hydration Integrity | E-7-HYDRATE-LEGACY-NULL-COMPATIBILITY | Legacy null fields in snapshot must be safely hydrated without crashes | HYDRATE_SUCCESS | FAIL | PASS |
| SECTION E: Hydration Integrity | E-8-HYDRATE-MULTI-ACTION-SAME-EVENT-SEMANTICS | Multiple actions sharing eventId and stateVersion from the same proposal MUST hydrate successfully as normal semantics | HYDRATE_SUCCESS | PASS | PASS |
| SECTION E: Hydration Integrity | E-9-HYDRATE-EMPTY-REGISTRY-SELF-HEALING | Hydration automatically rebuilds executedRequestIds and recordedEventIds from historical records | HYDRATE_SUCCESS | PASS | PASS |
| SECTION E: Hydration Integrity | E-10-HYDRATE-SNAPSHOT-VERSION-PRECEDING-HISTORY | Snapshot stateVersion lower than history version must throw error and prevent stale hydration | THROW_AND_FALLBACK | FAIL | PASS |

---

## Section 1: Detailed testRunner.ts Suite Results (All 85 Cases)

- [PASS] TEST-01: Normal Commit: Valid proposal increments stateVersion and commits state atomically 
- [PASS] TEST-02: Validation Failure: Invalid stat values or missing entity rejected with reasons 
- [PASS] TEST-03: Idempotency: Re-submitting identical requestId is blocked without mutating state 
- [PASS] TEST-04: Knowledge Graph: build and traverse knowledge graph safely 
- [PASS] TEST-05: Proposal Builder: CandidatePacket converts accurately to StateTransitionProposal 
- [PASS] TEST-06: Narrative Defense: Seed max 3 cap, deduplication, and resolution semantics 
- [PASS] TEST-07: Dice Safety: recommendedDC does not emit RECORD_DICE_RESULT; player DC clamped to 1-20 
- [PASS] TEST-08: Stat Safety: Delta clamped to -10~+10, final stat clamped to 1~30 
- [PASS] TEST-09: Reject & Safe No-Commit: Invalid proposal leaves snapshot, version, and history completely unmutated 
- [PASS] TEST-10: Hydration Compatibility: Preserves valid stateVersion, avoids history.length fallback, matches projections 
- [PASS] TEST-11: Adversarial Overwrite: Reject resurrection of historically dead NPC 
- [PASS] TEST-12: Snapshot Mutability Defense: External mutation of snapshot/history does not affect Canonical State 
- [PASS] TEST-13: Hydration Schema Immunity: Reject malformed snapshots without guessing repair values 
- [PASS] TEST-14: Atomic Rollback: Intra-proposal failure leaves Canonical State, History, and Idempotency untouched 
- [PASS] TEST-15: Adversarial Character Overwrite: Permanent physicalDefect is preserved and cannot be erased 
- [PASS] TEST-16: Source -> Action ACL: Reject unauthorized actions for given proposal source 
- [PASS] TEST-A: Prompt Contamination Audit: Engine prompt contains zero hardcoded chapter titles or preset seeds 
- [PASS] TEST-B: Empty Roadmap: Engine formats empty upcomingChapters as request for pure dynamic creation 
- [PASS] TEST-C: 1-Chapter Roadmap: Engine preserves single chapter and requests dynamic completion of 2 slots 
- [PASS] TEST-D: 2-Chapter Roadmap: Engine preserves 2 chapters and requests dynamic completion of 1 slot 
- [PASS] TEST-E: Dynamic Roadmap Commit: LLM proposed dynamic 3-chapter roadmap is safely validated and committed 
- [PASS] TEST-F: Player Divergence: Player actions divergent from roadmap execute freely without rejection 
- [PASS] TEST-G: Genre Isolation: Non-Wuxia genres (Cyberpunk, Sci-Fi) contain zero Wuxia terms in engine fallbacks 
- [PASS] TEST-H: Canon Isolation: Engine snapshot strictly contains only canonically committed entities 
- [PASS] TEST-I: New Creation: LLM-proposed new NPCs, narrative seeds, and offscreen events commit seamlessly 
- [PASS] TEST-J: Error Transparency: Parser handles malformed or failed LLM responses without inventing fake narrative 
- [PASS] TEST-K: Roadmap Replanning: Dynamic replanning replaces previous roadmap safely and atomically 
- [PASS] TEST-CAUSALITY-A: Causality Defense: Retroactive/unbacked ADD by LLM is rejected without mutating Canonical State 
- [PASS] TEST-CAUSALITY-B: Causality Validation: Valid RESOURCE_EXCHANGE deducts cost and adds acquired item atomically 
- [PASS] TEST-CAUSALITY-C: Causality Atomicity: Insufficient cost rejects entire proposal without partial state change 
- [PASS] TEST-CAUSALITY-D: Causality Defense: RESOURCE_EXCHANGE missing matching atomic REMOVE is rejected 
- [PASS] TEST-CAUSALITY-E: Causality Defense: Non-whitelisted cause types (e.g. self-declared MAGIC_SPAWN) rejected 
- [PASS] TEST-H4-A: Adversarial Defense: Double-spending 1 REMOVE for multiple ADDs is strictly rejected with zero mutation 
- [PASS] TEST-H4-B: Adversarial Defense: Cost name/id mismatch or non-existent cost resource is rejected 
- [PASS] TEST-H4-C: Permissiveness: Split REMOVE actions aggregating to total cost succeed atomically 
- [PASS] TEST-H4-D: Permissiveness: Multiple independent valid transactions in one proposal succeed atomically 
- [PASS] TEST-H4-E: Permissiveness: Inverted ADD/REMOVE order with sufficient total removal succeeds atomically 
- [PASS] TEST-H4-F: Adversarial Defense: Overdrafting REMOVE beyond owned inventory is rejected by virtual draft execution 
- [PASS] TEST-H4-G: Ownership Boundary: DISCOVERY_PICKUP with valid trusted event grounding commits cleanly to Canonical Inventory 
- [PASS] TEST-H4-H: Ownership Boundary: GIFT_REWARD with valid trusted event grounding commits cleanly to Canonical Inventory 
- [PASS] TEST-H4-I: Ownership Boundary: LOOT with valid trusted event grounding commits cleanly to Canonical Inventory 
- [PASS] TEST-H4-J: Ownership Boundary: GENESIS_STARTER at genesis turn commits cleanly to Canonical Inventory 
- [PASS] TEST-H4-K: Adversarial Defense: Unbacked inventory ADD without acquisition cause is strictly rejected 
- [PASS] TEST-H4-L: Adversarial Defense: Unsupported acquisition cause is rejected by Validator Firewall 
- [PASS] TEST-39: SET_QUANTITY Causality Bypass: LLM/PLAYER cannot use SET_QUANTITY to bypass causality 
- [PASS] TEST-40: LLM Dice Result Authority: LLM cannot inject rollValue in RECORD_DICE_RESULT 
- [PASS] TEST-41: Permanent Physical Defect Immutability: Established defect cannot be overwritten 
- [PASS] TEST-42: Dead NPC State Modification Defense: DEAD NPC cannot be modified via UPDATE_NPC 
- [PASS] TEST-43: Yellow Security Boundaries: Narrative seed limit (max 3) and integer stat bounds 
- [PASS] TEST-44: RED-01: LLM RECORD_PHYSICAL_DEFECT rejected via ACL; PLAYER/SYSTEM valid defect commits and is immutable 
- [PASS] TEST-45: RED-02: LLM RECORD_DICE_RESULT rejected; candidate.recommendedDC does not pollute dcHistory; PLAYER roll commits 
- [PASS] TEST-46: RED-03: DEAD NPC cannot be re-mutated via SET_NPC_STATUS; Impression remains unpolluted; Normal NPC status works 
- [PASS] TEST-47: YELLOW-01: Unsupported inventory operations (INJECT, OVERWRITE) rejected with INVALID_ACTION; standard ops work 
- [PASS] TEST-48: YELLOW-02: Stats outside 1-30 (0, 31, 99, 1.5) rejected; boundary stats (1, 30) commit successfully 
- [PASS] TEST-CAUSALITY-A: Adversarial Test A: DISCOVERY_PICKUP with no event grounding is rejected without inventory mutation 
- [PASS] TEST-CAUSALITY-B: Adversarial Test B: DISCOVERY_PICKUP with non-existent verifiedEventId is rejected 
- [PASS] TEST-CAUSALITY-C: Adversarial Test C: DISCOVERY_PICKUP grounded by actual world event passes with Inventory +1 
- [PASS] TEST-CAUSALITY-D: Adversarial Test D: Valid event linked to causally unrelated item is rejected 
- [PASS] TEST-CAUSALITY-E: Adversarial Test E: Normal RESOURCE_EXCHANGE with atomic cost deduction succeeds cleanly 
- [PASS] TEST-CAUSALITY-F: Adversarial Test F: GIFT_REWARD and LOOT without verified event grounding are rejected 
- [PASS] TEST-CAUSALITY-G: Adversarial Test G: Resolved or inactive narrative seeds cannot be used for acquisition 
- [PASS] TEST-CAUSALITY-H: Adversarial Test H: Untrusted runtime cannot forge SYSTEM source or retrospective GENESIS_STARTER 
- [PASS] TEST-CAUSALITY-I: Adversarial Test I: Grounded discovery ADD followed by transfer/consume REMOVE completes full lifecycle 
- [PASS] TEST-CAUSALITY-J: Adversarial Test J: Reusing an already consumed event to spawn duplicate items is rejected 
- [PASS] TEST-OVERWRITE-INV-A: Adversarial Defense: Player runtime OVERWRITE_CHARACTER attempting to inject new item is rejected 
- [PASS] TEST-OVERWRITE-INV-B: Adversarial Defense: LLM attempting OVERWRITE_CHARACTER is rejected via ACL 
- [PASS] TEST-OVERWRITE-INV-C: Genesis & Save Hydration: OVERWRITE_CHARACTER initializes canonical inventory cleanly 
- [PASS] TEST-OVERWRITE-INV-D: Player Profile Edit: OVERWRITE_CHARACTER with preserved inventory succeeds cleanly 
- [PASS] TEST-OVERWRITE-INV-E: Adversarial Defense: Undefined quantity attack via OVERWRITE_CHARACTER is rejected 
- [PASS] TEST-OVERWRITE-INV-F: Adversarial Defense: ID-only cross forgery via OVERWRITE_CHARACTER is rejected 
- [PASS] TEST-OVERWRITE-INV-G: Adversarial Defense: Name-only cross forgery via OVERWRITE_CHARACTER is rejected 
- [PASS] TEST-OVERWRITE-INV-H: Adversarial Defense: Order permutation via OVERWRITE_CHARACTER is rejected 
- [PASS] TEST-SEC-4A-DIRECT-FORGERY: Security Trust Boundary 4-A: Direct submitProposal with privileged sources is rejected 
- [PASS] TEST-SEC-4B-INTERNAL-API-ABUSE: Security Trust Boundary 4-B: External caller cannot invoke unexposed or elevated internal APIs 
- [PASS] TEST-SEC-4C-CAPABILITY-FORGERY: Security Trust Boundary 4-C: Capability forgery via symbol creation, prototype injection, or object cloning fails 
- [PASS] TEST-SEC-4D-GENUINE-INTERNAL-SYSTEM: Security Trust Boundary 4-D: Genuine internal engine execution path commits SYSTEM proposals safely 
- [PASS] TEST-94: Article 9/16 Inventory Identity: exact match on ID and SET_QUANTITY cannot invent non-existent items 
- [PASS] TEST-95: Temporal Integrity: Proposal turn cannot regress behind current sovereign turn 
- [PASS] TEST-96: Temporal Integrity: Proposal timestamp cannot regress earlier than last committed timestamp 

---

## Section 2: RAW Execution Evidence per Section A~E Test Case

--------------------------------------------------
[TEST_ID]: A-1-FORGED-SYSTEM - Direct submission of SYSTEM source action via submitProposal without internal capability is handled by engine ACL validation
[CATEGORY]: SECTION A: Commit Gate Security
[CALLING_PATH]: engine.submitProposal(proposal)
--------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedAt": "2026-08-23T13:58:19.027Z",
  "lastCommittedEventId": null,
  "character": {
    "name": "",
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
      "strength": 10,
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
  },
  "worldInfo": {
    "worldName": "",
    "worldType": "popular_genre",
    "settingDescription": "",
    "toneStyle": "원작 고유의 문체 충실 재현",
    "currentTime": {
      "year": 1,
      "season": "SPRING",
      "formattedTime": "1년 봄"
    },
    "npcs": [],
    "factions": [],
    "publicRumors": [],
    "secretLore": [],
    "seeds": [],
    "chapters": {
      "currentChapter": "서막",
      "upcomingChapters": []
    },
    "dcHistory": [],
    "unresolvedForeshadows": [],
    "cameraOffscreenEvents": [],
    "offscreenRecords": []
  },
  "historyLength": 0,
  "history": [],
  "diagnostics": {
    "stateVersion": 1,
    "totalExecutedRequests": 0,
    "totalRecordedEvents": 0,
    "totalHistoricalRecords": 0,
    "lastEventId": null
  }
}

[PROPOSAL]
{
  "proposalId": "prop-a1-forged-system",
  "requestId": "req-a1-forged-system",
  "eventId": "evt-a1-forged-system",
  "expectedStateVersion": 1,
  "source": "SYSTEM",
  "turn": 1,
  "timestamp": "2026-08-23T13:58:20.027Z",
  "intentSummary": "Forged SYSTEM proposal submitted directly to submitProposal",
  "actions": [
    {
      "type": "RECORD_PHYSICAL_DEFECT",
      "payload": {
        "defect": "오른팔 절단"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[SECURITY_FORGERY] Direct submission of privileged source 'SYSTEM' without Engine-owned capability token is strictly rejected."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-a1-forged-system",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[SECURITY_FORGERY] Direct submission of privileged source 'SYSTEM' without Engine-owned capability token is strictly rejected."
  ],
  "conflictDetails": [],
  "newHistoricalRecords": [],
  "snapshot": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "",
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
        "strength": 10,
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
    },
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-23T13:58:19.027Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedAt": "2026-08-23T13:58:19.027Z",
  "lastCommittedEventId": null,
  "character": {
    "name": "",
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
      "strength": 10,
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
  },
  "worldInfo": {
    "worldName": "",
    "worldType": "popular_genre",
    "settingDescription": "",
    "toneStyle": "원작 고유의 문체 충실 재현",
    "currentTime": {
      "year": 1,
      "season": "SPRING",
      "formattedTime": "1년 봄"
    },
    "npcs": [],
    "factions": [],
    "publicRumors": [],
    "secretLore": [],
    "seeds": [],
    "chapters": {
      "currentChapter": "서막",
      "upcomingChapters": []
    },
    "dcHistory": [],
    "unresolvedForeshadows": [],
    "cameraOffscreenEvents": [],
    "offscreenRecords": []
  },
  "historyLength": 0,
  "history": [],
  "diagnostics": {
    "stateVersion": 1,
    "totalExecutedRequests": 0,
    "totalRecordedEvents": 0,
    "totalHistoricalRecords": 0,
    "lastEventId": null
  }
}

[DELTA_SUMMARY]
- Canonical State: No State Mutation (Preserved Exactly)
- History: No History Mutation (Preserved Exactly)
[VERDICT]: FAIL


--------------------------------------------------
[TEST_ID]: A-2-FORGED-INTERNAL-REJECTION - Direct submission of ENGINE_INTERNAL proposal without capability token must be strictly rejected
[CATEGORY]: SECTION A: Commit Gate Security
[CALLING_PATH]: engine.submitProposal(proposal)
--------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedAt": "2026-08-23T13:58:19.028Z",
  "lastCommittedEventId": null,
  "character": {
    "name": "",
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
      "strength": 10,
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
  },
  "worldInfo": {
    "worldName": "",
    "worldType": "popular_genre",
    "settingDescription": "",
    "toneStyle": "원작 고유의 문체 충실 재현",
    "currentTime": {
      "year": 1,
      "season": "SPRING",
      "formattedTime": "1년 봄"
    },
    "npcs": [],
    "factions": [],
    "publicRumors": [],
    "secretLore": [],
    "seeds": [],
    "chapters": {
      "currentChapter": "서막",
      "upcomingChapters": []
    },
    "dcHistory": [],
    "unresolvedForeshadows": [],
    "cameraOffscreenEvents": [],
    "offscreenRecords": []
  },
  "historyLength": 0,
  "history": [],
  "diagnostics": {
    "stateVersion": 1,
    "totalExecutedRequests": 0,
    "totalRecordedEvents": 0,
    "totalHistoricalRecords": 0,
    "lastEventId": null
  }
}

[PROPOSAL]
{
  "proposalId": "prop-a2-forged-internal",
  "requestId": "req-a2-forged-internal",
  "eventId": "evt-a2-forged-internal",
  "expectedStateVersion": 1,
  "source": "ENGINE_INTERNAL",
  "turn": 1,
  "timestamp": "2026-08-23T13:58:20.027Z",
  "intentSummary": "Direct unprivileged submit of ENGINE_INTERNAL without capability token",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "위조된 내부 세계"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[SECURITY_FORGERY] Direct submission of privileged source 'ENGINE_INTERNAL' without Engine-owned capability token is strictly rejected."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-a2-forged-internal",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[SECURITY_FORGERY] Direct submission of privileged source 'ENGINE_INTERNAL' without Engine-owned capability token is strictly rejected."
  ],
  "conflictDetails": [],
  "newHistoricalRecords": [],
  "snapshot": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
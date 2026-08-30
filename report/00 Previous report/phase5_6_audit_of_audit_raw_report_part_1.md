# TRPG 3.1 — Phase 5.6 Audit-of-Audit Raw Execution Report (Part 1/5)

> Lines 1 ~ 500 of 2303

```json
================================================================================
TRPG 3.1 Sovereign Runtime — Phase 5.6 Adversarial Forensic Audit Raw Log
Timestamp: 2026-08-23T16:45:47.073Z
Target Codebase: 3.1upload5 (HEAD)
Authoritative Runtime: src/engine/state.ts (SovereignEngine)
================================================================================

--------------------------------------------------------------------------------
[CASE-01] VALIDATOR REJECTION AND COMPLETE STATE IMMUTABILITY
Category: State Boundary & Immutability
Verdict: [PASS]
--------------------------------------------------------------------------------

[BEFORE]
{
  "stateVersion": 1,
  "turn": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T16:45:47.058Z",
  "character": {
    "name": "주인공",
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
    "inventory": [
      {
        "id": "inv-1",
        "name": "철검",
        "quantity": 1
      }
    ],
    "secret": "",
    "physicalDefect": "",
    "timeline": []
  },
  "worldInfo": {
    "worldName": "불변성테스트세계",
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
  "proposalId": "prop-test1-illegal",
  "requestId": "req-test1-illegal",
  "eventId": "evt-test1-illegal",
  "expectedStateVersion": 999,
  "source": "LLM",
  "turn": 1,
  "timestamp": "2026-08-23T16:45:47.059Z",
  "intentSummary": "Stale version attack",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "오염된세계"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 999, but current sovereign state is at version 1."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
NOT REACHED

[AFTER]
{
  "stateVersion": 1,
  "turn": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T16:45:47.058Z",
  "character": {
    "name": "주인공",
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
    "inventory": [
      {
        "id": "inv-1",
        "name": "철검",
        "quantity": 1
      }
    ],
    "secret": "",
    "physicalDefect": "",
    "timeline": []
  },
  "worldInfo": {
    "worldName": "불변성테스트세계",
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

[STATE COMPARISON]
Is Identical: true
Diffs: NONE (100% Immutable)
Notes: Validator correctly rejected stale version, commit was not reached, and canonical state remained completely identical.

--------------------------------------------------------------------------------
[CASE-02] ATOMIC DRAFT EXECUTION & PARTIAL COMMIT PREVENTION (VALIDATOR PASS -> DRAFT CRASH -> ROLLBACK)
Category: Atomicity & Rollback
Verdict: [PASS]
--------------------------------------------------------------------------------

[BEFORE]
{
  "stateVersion": 1,
  "turn": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T16:45:47.067Z",
  "character": {
    "name": "주인공",
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
    "inventory": [
      {
        "id": "inv-gold",
        "name": "금화",
        "quantity": 10
      }
    ],
    "secret": "",
    "physicalDefect": "",
    "timeline": []
  },
  "worldInfo": {
    "worldName": "원자성테스트세계",
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
  "proposalId": "prop-test2-atomic-rollback",
  "requestId": "req-test2-atomic-rollback",
  "eventId": "evt-test2-atomic-rollback",
  "expectedStateVersion": 1,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T16:45:48.067Z",
  "intentSummary": "Multi-action atomic draft failure test",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "중간변조세계"
      }
    },
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "두번째변조시도세계",
        "triggerExecutionCrash": "[THROWS IN STEP 2 DRAFT]"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": true,
  "rejectedReasons": [],
  "conflictDetails": [],
  "sanitizedActionsCount": 2
}

[COMMIT]
NOT REACHED

[AFTER]
{
  "stateVersion": 1,
  "turn": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T16:45:47.067Z",
  "character": {
    "name": "주인공",
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
    "inventory": [
      {
        "id": "inv-gold",
        "name": "금화",
        "quantity": 10
      }
    ],
    "secret": "",
    "physicalDefect": "",
    "timeline": []
  },
  "worldInfo": {
    "worldName": "원자성테스트세계",
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

[STATE COMPARISON]
Is Identical: true
Diffs: NONE (100% Immutable)
Notes: EngineValidator PASS (isValid=true, 2 actions sanitized) -> Action 1 applied to isolated draft -> Action 2 threw in Step 2 draft -> Step 3 caught error and rolled back -> Step 4 Commit NOT REACHED -> BEFORE === AFTER (stateVersion, worldInfo, history, registries 100% untouched).

--------------------------------------------------------------------------------
[CASE-03] DUPLICATE REQUEST ID PROPOSAL REPLAY BLOCKED
Category: Idempotency & Replay Defense
Verdict: [PASS]
--------------------------------------------------------------------------------

[BEFORE]
{
  "stateVersion": 2,
  "turn": 1,
  "lastCommittedEventId": "evt-test3-first",
  "lastCommittedAt": "2026-08-23T16:45:47.069Z",
  "character": {
    "name": "주인공",
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
    "worldName": "정상갱신세계",
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
  "historyLength": 1,
  "history": [
    {
      "recordId": "rec-evt-test3-first-1",
      "eventId": "evt-test3-first",
      "requestId": "req-test3-duplicate",
      "proposalId": "prop-test3-orig",
      "actionType": "SET_WORLD_METADATA",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"worldName\":\"정상갱신세계\"}"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-test3-first"
  }
}

[PROPOSAL]
{
  "proposalId": "prop-test3-replay",
  "requestId": "req-test3-duplicate",
  "eventId": "evt-test3-second",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T16:45:48.070Z",
```

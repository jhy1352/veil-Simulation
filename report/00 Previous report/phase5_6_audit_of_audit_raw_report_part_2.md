# TRPG 3.1 — Phase 5.6 Audit-of-Audit Raw Execution Report (Part 2/5)

> Lines 501 ~ 1000 of 2303

```json
  "intentSummary": "Replay attack",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "리플레이오염세계"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[IDEMPOTENCY_VIOLATION] Request ID 'req-test3-duplicate' has already been processed."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
NOT REACHED

[AFTER]
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

[STATE COMPARISON]
Is Identical: true
Diffs: NONE (100% Immutable)
Notes: EngineValidator detected duplicate requestId req-test3-duplicate and rejected replay attempt completely.

--------------------------------------------------------------------------------
[CASE-04] DUPLICATE EVENT ID PROPOSAL REPLAY BLOCKED
Category: Event Registry Integrity
Verdict: [PASS]
--------------------------------------------------------------------------------

[BEFORE]
{
  "stateVersion": 2,
  "turn": 1,
  "lastCommittedEventId": "evt-test4-duplicate",
  "lastCommittedAt": "2026-08-23T16:45:47.070Z",
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
    "worldName": "이벤트1차세계",
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
      "recordId": "rec-evt-test4-duplicate-1",
      "eventId": "evt-test4-duplicate",
      "requestId": "req-test4-first",
      "proposalId": "prop-test4-orig",
      "actionType": "SET_WORLD_METADATA",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"worldName\":\"이벤트1차세계\"}"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-test4-duplicate"
  }
}

[PROPOSAL]
{
  "proposalId": "prop-test4-replay",
  "requestId": "req-test4-different",
  "eventId": "evt-test4-duplicate",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T16:45:48.070Z",
  "intentSummary": "Duplicate eventId attack",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "이벤트중복오염세계"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[EVENT_CONFLICT] Event ID 'evt-test4-duplicate' already exists in historical event registry."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
NOT REACHED

[AFTER]
{
  "stateVersion": 2,
  "turn": 1,
  "lastCommittedEventId": "evt-test4-duplicate",
  "lastCommittedAt": "2026-08-23T16:45:47.070Z",
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
    "worldName": "이벤트1차세계",
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
      "recordId": "rec-evt-test4-duplicate-1",
      "eventId": "evt-test4-duplicate",
      "requestId": "req-test4-first",
      "proposalId": "prop-test4-orig",
      "actionType": "SET_WORLD_METADATA",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"worldName\":\"이벤트1차세계\"}"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-test4-duplicate"
  }
}

[STATE COMPARISON]
Is Identical: true
Diffs: NONE (100% Immutable)
Notes: EngineValidator detected duplicate eventId evt-test4-duplicate in recordedEventIds registry and blocked execution.

--------------------------------------------------------------------------------
[CASE-05] MULTI-ACTION PROPOSAL SHARED EVENT ID SEMANTICS PRESERVED
Category: Transaction & History Semantics
Verdict: [PASS]
--------------------------------------------------------------------------------

[BEFORE]
{
  "stateVersion": 1,
  "turn": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T16:45:47.070Z",
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
        "name": "은화",
        "quantity": 20
      }
    ],
    "secret": "",
    "physicalDefect": "",
    "timeline": []
  },
  "worldInfo": {
    "worldName": "멀티액션세계",
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
  "proposalId": "prop-test5-multi",
  "requestId": "req-test5-multi",
  "eventId": "evt-test5-shared-id",
  "expectedStateVersion": 1,
  "source": "LLM",
  "turn": 1,
  "timestamp": "2026-08-23T16:45:47.070Z",
  "intentSummary": "Multi-action transaction: metadata, rumor, seed",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "진보한세계"
      }
    },
    {
      "type": "ADD_RUMOR",
      "payload": {
        "rumor": "소문: 북쪽 산맥에 고룡이 깨어났다."
      }
    },
    {
      "type": "ADD_NARRATIVE_SEED",
      "payload": {
        "id": "seed-test5-dragon",
        "content": "북쪽 산맥의 고룡 수색",
        "status": "active"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": true,
  "rejectedReasons": [],
  "conflictDetails": [],
  "sanitizedActions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "진보한세계"
      }
    },
    {
      "type": "ADD_RUMOR",
      "payload": {
        "rumor": "소문: 북쪽 산맥에 고룡이 깨어났다."
      }
    },
    {
      "type": "ADD_NARRATIVE_SEED",
      "payload": {
        "id": "seed-test5-dragon",
        "content": "북쪽 산맥의 고룡 수색",
        "status": "active"
      }
    }
  ]
}

[COMMIT]
{
  "success": true,
  "stateVersion": 2,
  "eventId": "evt-test5-shared-id",
  "committedActionsCount": 3,
  "rejectedReasons": [],
  "conflictDetails": [],
  "newHistoricalRecords": [
    {
      "recordId": "rec-evt-test5-shared-id-1",
      "eventId": "evt-test5-shared-id",
      "requestId": "req-test5-multi",
      "proposalId": "prop-test5-multi",
      "turn": 1,
      "timestamp": "2026-08-23T16:45:47.070Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "LLM",
      "actionType": "SET_WORLD_METADATA",
      "details": "{\"worldName\":\"진보한세계\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    },
    {
      "recordId": "rec-evt-test5-shared-id-2",
      "eventId": "evt-test5-shared-id",
      "requestId": "req-test5-multi",
      "proposalId": "prop-test5-multi",
      "turn": 1,
      "timestamp": "2026-08-23T16:45:47.070Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
```

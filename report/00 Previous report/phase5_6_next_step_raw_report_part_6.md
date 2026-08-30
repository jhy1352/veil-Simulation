      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "제2장 하산",
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
        "strength": 12,
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
    "lastCommittedEventId": "evt-c2-turn2",
    "lastCommittedAt": "2026-08-23T13:58:21.027Z"
  }
}

[AFTER]
{
  "turn": 2,
  "stateVersion": 3,
  "lastCommittedAt": "2026-08-23T13:58:21.027Z",
  "lastCommittedEventId": "evt-c2-turn2",
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
      "strength": 12,
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
      "currentChapter": "제2장 하산",
      "upcomingChapters": []
    },
    "dcHistory": [],
    "unresolvedForeshadows": [],
    "cameraOffscreenEvents": [],
    "offscreenRecords": []
  },
  "historyLength": 2,
  "history": [
    {
      "recordId": "rec-evt-c2-turn1-1",
      "eventId": "evt-c2-turn1",
      "requestId": "req-c2-turn1",
      "proposalId": "prop-c2-turn1",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "PLAYER",
      "actionType": "UPDATE_CHARACTER_STATS",
      "details": "{\"strength\":12}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    },
    {
      "recordId": "rec-evt-c2-turn2-1",
      "eventId": "evt-c2-turn2",
      "requestId": "req-c2-turn2",
      "proposalId": "prop-c2-turn2",
      "turn": 2,
      "timestamp": "2026-08-23T13:58:21.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "LLM",
      "actionType": "ADVANCE_CHAPTER",
      "details": "{\"currentChapter\":\"제2장 하산\"}",
      "stateVersionAfterCommit": 3,
      "informationAccess": "PUBLIC"
    }
  ],
  "diagnostics": {
    "stateVersion": 3,
    "totalExecutedRequests": 2,
    "totalRecordedEvents": 2,
    "totalHistoricalRecords": 2,
    "lastEventId": "evt-c2-turn2"
  }
}

[DELTA_SUMMARY]
- Canonical State: stateVersion: 2 -> 3, lastCommittedEventId: evt-c2-turn1 -> evt-c2-turn2
- History: historyLength: 1 -> 2 (+1 records)
[VERDICT]: PASS


--------------------------------------------------
[TEST_ID]: D-1-DUPLICATE-REQUEST-ID-REPLAY - Duplicate requestId replay must be rejected and state preserved
[CATEGORY]: SECTION D: Replay & Idempotency
[CALLING_PATH]: engine.submitProposal(duplicateProposal)
--------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 2,
  "lastCommittedAt": "2026-08-23T13:58:20.027Z",
  "lastCommittedEventId": "evt-d1-1",
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
    "worldName": "D1 World",
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
      "recordId": "rec-evt-d1-1-1",
      "eventId": "evt-d1-1",
      "requestId": "req-d1-same",
      "proposalId": "prop-d1-1",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "PLAYER",
      "actionType": "SET_WORLD_METADATA",
      "details": "{\"worldName\":\"D1 World\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-d1-1"
  }
}

[PROPOSAL]
{
  "proposalId": "prop-d1-2",
  "requestId": "req-d1-same",
  "eventId": "evt-d1-2",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T13:58:21.027Z",
  "intentSummary": "Replay with same requestId",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "D1 Tampered"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[IDEMPOTENCY_VIOLATION] Request ID 'req-d1-same' has already been processed."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 2,
  "eventId": "evt-d1-2",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[IDEMPOTENCY_VIOLATION] Request ID 'req-d1-same' has already been processed."
  ],
  "conflictDetails": [],
  "newHistoricalRecords": [],
  "snapshot": {
    "stateVersion": 2,
    "turn": 1,
    "worldInfo": {
      "worldName": "D1 World",
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
    "lastCommittedEventId": "evt-d1-1",
    "lastCommittedAt": "2026-08-23T13:58:20.027Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 2,
  "lastCommittedAt": "2026-08-23T13:58:20.027Z",
  "lastCommittedEventId": "evt-d1-1",
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
    "worldName": "D1 World",
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
      "recordId": "rec-evt-d1-1-1",
      "eventId": "evt-d1-1",
      "requestId": "req-d1-same",
      "proposalId": "prop-d1-1",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "PLAYER",
      "actionType": "SET_WORLD_METADATA",
      "details": "{\"worldName\":\"D1 World\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-d1-1"
  }
}

[DELTA_SUMMARY]
- Canonical State: No State Mutation (Preserved Exactly)
- History: No History Mutation (Preserved Exactly)
[VERDICT]: PASS


--------------------------------------------------
[TEST_ID]: D-2-DUPLICATE-EVENT-ID-REPLAY - Duplicate eventId replay must be rejected and state preserved
[CATEGORY]: SECTION D: Replay & Idempotency
[CALLING_PATH]: engine.submitProposal(duplicateProposal)
--------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 2,
  "lastCommittedAt": "2026-08-23T13:58:20.027Z",
  "lastCommittedEventId": "evt-d2-same",
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
    "worldName": "D2 World",
    "worldType": "popular_genre",
    "settingDescription": "",
    "toneStyle": "원작 고유의 문체 충실 재현",
    "currentTime": {
      "year": 1,
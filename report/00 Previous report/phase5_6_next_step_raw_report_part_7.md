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
      "recordId": "rec-evt-d2-same-1",
      "eventId": "evt-d2-same",
      "requestId": "req-d2-1",
      "proposalId": "prop-d2-1",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "PLAYER",
      "actionType": "SET_WORLD_METADATA",
      "details": "{\"worldName\":\"D2 World\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-d2-same"
  }
}

[PROPOSAL]
{
  "proposalId": "prop-d2-2",
  "requestId": "req-d2-2",
  "eventId": "evt-d2-same",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T13:58:21.027Z",
  "intentSummary": "Replay with same eventId",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "D2 Tampered"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[EVENT_CONFLICT] Event ID 'evt-d2-same' already exists in historical event registry."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 2,
  "eventId": "evt-d2-same",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[EVENT_CONFLICT] Event ID 'evt-d2-same' already exists in historical event registry."
  ],
  "conflictDetails": [],
  "newHistoricalRecords": [],
  "snapshot": {
    "stateVersion": 2,
    "turn": 1,
    "worldInfo": {
      "worldName": "D2 World",
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
    "lastCommittedEventId": "evt-d2-same",
    "lastCommittedAt": "2026-08-23T13:58:20.027Z"
  }
}

[AFTER]
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
      "recordId": "rec-evt-d2-same-1",
      "eventId": "evt-d2-same",
      "requestId": "req-d2-1",
      "proposalId": "prop-d2-1",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "PLAYER",
      "actionType": "SET_WORLD_METADATA",
      "details": "{\"worldName\":\"D2 World\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-d2-same"
  }
}

[DELTA_SUMMARY]
- Canonical State: No State Mutation (Preserved Exactly)
- History: No History Mutation (Preserved Exactly)
[VERDICT]: PASS


--------------------------------------------------
[TEST_ID]: D-3-PARTIAL-ACTION-FAILURE-ATOMIC-ROLLBACK - When any single action in a proposal fails validation, the entire proposal is rejected and Action #1 is NEVER partially applied
[CATEGORY]: SECTION D: Atomicity
[CALLING_PATH]: engine.submitProposal(multiPartialInvalid)
--------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedAt": "2026-08-23T13:58:19.032Z",
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
  "proposalId": "prop-d3-partial-invalid",
  "requestId": "req-d3-partial-invalid",
  "eventId": "evt-d3-partial-invalid",
  "expectedStateVersion": 1,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T13:58:20.027Z",
  "intentSummary": "Multi-action batch: Action #1 valid, Action #2 invalid",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "이 이름은 커밋되면 안됨"
      }
    },
    {
      "type": "UPDATE_CHARACTER_STATS",
      "payload": {
        "strength": 9999
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[INVALID_STAT_VALUE] Action #2: Stat 'strength' must be a finite integer between 1 and 30. Received: 9999"
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-d3-partial-invalid",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[INVALID_STAT_VALUE] Action #2: Stat 'strength' must be a finite integer between 1 and 30. Received: 9999"
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
    "lastCommittedAt": "2026-08-23T13:58:19.032Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedAt": "2026-08-23T13:58:19.032Z",
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
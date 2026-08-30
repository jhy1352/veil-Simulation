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
  "proposalId": "prop-c1-multi-action",
  "requestId": "req-c1-multi-action",
  "eventId": "evt-c1-multi-action",
  "expectedStateVersion": 1,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T13:58:20.027Z",
  "intentSummary": "Set world metadata and update stats simultaneously",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "정파무림",
        "settingDescription": "화산파 본산"
      }
    },
    {
      "type": "UPDATE_CHARACTER_STATS",
      "payload": {
        "strength": 16,
        "agility": 14
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
        "worldName": "정파무림",
        "settingDescription": "화산파 본산"
      }
    },
    {
      "type": "UPDATE_CHARACTER_STATS",
      "payload": {
        "strength": 16,
        "agility": 14
      }
    }
  ]
}

[COMMIT]
{
  "success": true,
  "stateVersion": 2,
  "eventId": "evt-c1-multi-action",
  "committedActionsCount": 2,
  "rejectedReasons": [],
  "conflictDetails": [],
  "newHistoricalRecords": [
    {
      "recordId": "rec-evt-c1-multi-action-1",
      "eventId": "evt-c1-multi-action",
      "requestId": "req-c1-multi-action",
      "proposalId": "prop-c1-multi-action",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "PLAYER",
      "actionType": "SET_WORLD_METADATA",
      "details": "{\"worldName\":\"정파무림\",\"settingDescription\":\"화산파 본산\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    },
    {
      "recordId": "rec-evt-c1-multi-action-2",
      "eventId": "evt-c1-multi-action",
      "requestId": "req-c1-multi-action",
      "proposalId": "prop-c1-multi-action",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "PLAYER",
      "actionType": "UPDATE_CHARACTER_STATS",
      "details": "{\"strength\":16,\"agility\":14}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    }
  ],
  "snapshot": {
    "stateVersion": 2,
    "turn": 1,
    "worldInfo": {
      "worldName": "정파무림",
      "worldType": "popular_genre",
      "settingDescription": "화산파 본산",
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
        "strength": 16,
        "agility": 14,
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
    "lastCommittedEventId": "evt-c1-multi-action",
    "lastCommittedAt": "2026-08-23T13:58:20.027Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 2,
  "lastCommittedAt": "2026-08-23T13:58:20.027Z",
  "lastCommittedEventId": "evt-c1-multi-action",
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
      "strength": 16,
      "agility": 14,
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
    "worldName": "정파무림",
    "worldType": "popular_genre",
    "settingDescription": "화산파 본산",
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
  "historyLength": 2,
  "history": [
    {
      "recordId": "rec-evt-c1-multi-action-1",
      "eventId": "evt-c1-multi-action",
      "requestId": "req-c1-multi-action",
      "proposalId": "prop-c1-multi-action",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "PLAYER",
      "actionType": "SET_WORLD_METADATA",
      "details": "{\"worldName\":\"정파무림\",\"settingDescription\":\"화산파 본산\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    },
    {
      "recordId": "rec-evt-c1-multi-action-2",
      "eventId": "evt-c1-multi-action",
      "requestId": "req-c1-multi-action",
      "proposalId": "prop-c1-multi-action",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "PLAYER",
      "actionType": "UPDATE_CHARACTER_STATS",
      "details": "{\"strength\":16,\"agility\":14}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 2,
    "lastEventId": "evt-c1-multi-action"
  }
}

[DELTA_SUMMARY]
- Canonical State: stateVersion: 1 -> 2, lastCommittedEventId: null -> evt-c1-multi-action
- History: historyLength: 0 -> 2 (+2 records)
[VERDICT]: PASS


--------------------------------------------------
[TEST_ID]: C-2-MULTI-TURN-SEQUENTIAL-COMMIT - Sequential multi-turn commits maintain monotonic stateVersion and history correspondence
[CATEGORY]: SECTION C: History-Canonical Correspondence
[CALLING_PATH]: engine.submitProposal(pTurn2)
--------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 2,
  "lastCommittedAt": "2026-08-23T13:58:20.027Z",
  "lastCommittedEventId": "evt-c2-turn1",
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
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-c2-turn1"
  }
}

[PROPOSAL]
{
  "proposalId": "prop-c2-turn2",
  "requestId": "req-c2-turn2",
  "eventId": "evt-c2-turn2",
  "expectedStateVersion": 2,
  "source": "LLM",
  "turn": 2,
  "timestamp": "2026-08-23T13:58:21.027Z",
  "intentSummary": "Turn 2 chapter advancement",
  "actions": [
    {
      "type": "ADVANCE_CHAPTER",
      "payload": {
        "currentChapter": "제2장 하산"
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
      "type": "ADVANCE_CHAPTER",
      "payload": {
        "currentChapter": "제2장 하산"
      }
    }
  ]
}

[COMMIT]
{
  "success": true,
  "stateVersion": 3,
  "eventId": "evt-c2-turn2",
  "committedActionsCount": 1,
  "rejectedReasons": [],
  "conflictDetails": [],
  "newHistoricalRecords": [
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
  "snapshot": {
    "stateVersion": 3,
    "turn": 2,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
[VERDICT]: PASS


--------------------------------------------------
[TEST_ID]: E-1-HYDRATE-NORMAL-VALID - Normal valid snapshot and history hydrate cleanly, restoring identical stateVersion and registries
[CATEGORY]: SECTION E: Hydration Integrity
[CALLING_PATH]: SovereignEngine.hydrate(validSnapshot, validHistory)
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
"(Direct Engine Operation / Hydration)"

[VALIDATOR]
{
  "isValid": true
}

[COMMIT]
{
  "success": true,
  "stateVersion": 2
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 2,
  "lastCommittedAt": "2026-08-23T13:58:20.027Z",
  "lastCommittedEventId": "evt-hyd-seed",
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
    "worldName": "Hydration World",
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
      "recordId": "rec-evt-hyd-seed-1",
      "eventId": "evt-hyd-seed",
      "requestId": "req-hyd-seed",
      "proposalId": "prop-hyd-seed",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "PLAYER",
      "actionType": "SET_WORLD_METADATA",
      "details": "{\"worldName\":\"Hydration World\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 2,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-hyd-seed"
  }
}

[DELTA_SUMMARY]
- Canonical State: stateVersion: 1 -> 2, lastCommittedEventId: null -> evt-hyd-seed
- History: historyLength: 0 -> 1 (+1 records)
[VERDICT]: PASS


--------------------------------------------------
[TEST_ID]: E-2-HYDRATE-TIMESTAMP-REGRESSION-REJECTION - Timestamp regression in history during hydration must throw error and trigger creation fallback
[CATEGORY]: SECTION E: Hydration Integrity
[CALLING_PATH]: SovereignEngine.hydrate(tamperedSnapshot, tamperedHistory)
--------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedAt": "2026-08-23T13:58:19.033Z",
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
"(Direct Engine Operation / Hydration)"

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[HYDRATION_INTEGRITY_VIOLATION] History timestamp regression at index 1: '2026-08-23T13:57:20.027Z' precedes '2026-08-23T13:58:20.027Z'."
  ]
}

[COMMIT]
NOT REACHED

[AFTER]
{
  "hydrated": false,
  "error": "[HYDRATION_INTEGRITY_VIOLATION] History timestamp regression at index 1: '2026-08-23T13:57:20.027Z' precedes '2026-08-23T13:58:20.027Z'.",
  "fallback": "CREATION_MODE_TRIGGERED"
}

[DELTA_SUMMARY]
- Canonical State: stateVersion: 1 -> undefined, lastCommittedEventId: null -> undefined
- History: historyLength: 0 -> undefined (+NaN records)
[VERDICT]: FAIL


--------------------------------------------------
[TEST_ID]: E-3-HYDRATE-TURN-REGRESSION-REJECTION - Turn regression in history during hydration must throw error and trigger creation fallback
[CATEGORY]: SECTION E: Hydration Integrity
[CALLING_PATH]: SovereignEngine.hydrate(tamperedSnapshot, tamperedHistory)
--------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedAt": "2026-08-23T13:58:19.033Z",
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
"(Direct Engine Operation / Hydration)"

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[HYDRATION_INTEGRITY_VIOLATION] History turn regression at index 1: turn 2 precedes turn 5."
  ]
}

[COMMIT]
NOT REACHED

[AFTER]
{
  "hydrated": false,
  "error": "[HYDRATION_INTEGRITY_VIOLATION] History turn regression at index 1: turn 2 precedes turn 5.",
  "fallback": "CREATION_MODE_TRIGGERED"
}

[DELTA_SUMMARY]
- Canonical State: stateVersion: 1 -> undefined, lastCommittedEventId: null -> undefined
- History: historyLength: 0 -> undefined (+NaN records)
[VERDICT]: FAIL


--------------------------------------------------
[TEST_ID]: E-4-HYDRATE-VERSION-REGRESSION-REJECTION - Version regression in history during hydration must throw error and trigger creation fallback
[CATEGORY]: SECTION E: Hydration Integrity
[CALLING_PATH]: SovereignEngine.hydrate(tamperedSnapshot, tamperedHistory)
--------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedAt": "2026-08-23T13:58:19.034Z",
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
"(Direct Engine Operation / Hydration)"

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[HYDRATION_INTEGRITY_VIOLATION] History stateVersion regression at index 1: version 3 precedes version 5."
  ]
}

[COMMIT]
NOT REACHED

[AFTER]
{
  "hydrated": false,
  "error": "[HYDRATION_INTEGRITY_VIOLATION] History stateVersion regression at index 1: version 3 precedes version 5.",
  "fallback": "CREATION_MODE_TRIGGERED"
}

[DELTA_SUMMARY]
- Canonical State: stateVersion: 1 -> undefined, lastCommittedEventId: null -> undefined
- History: historyLength: 0 -> undefined (+NaN records)
[VERDICT]: FAIL


--------------------------------------------------
[TEST_ID]: E-5-HYDRATE-SNAPSHOT-HISTORY-VERSION-MISMATCH - Snapshot stateVersion differing from history stateVersionAfterCommit must throw error
[CATEGORY]: SECTION E: Hydration Integrity
[CALLING_PATH]: SovereignEngine.hydrate(tamperedSnapshot, validHistory)
--------------------------------------------------
[BEFORE]
{
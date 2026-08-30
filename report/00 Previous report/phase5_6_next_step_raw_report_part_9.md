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
  "isValid": true
}

[COMMIT]
{
  "success": true
}

[AFTER]
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

[DELTA_SUMMARY]
- Canonical State: No State Mutation (Preserved Exactly)
- History: No History Mutation (Preserved Exactly)
[VERDICT]: FAIL


--------------------------------------------------
[TEST_ID]: E-6-HYDRATE-LAST-EVENT-PROVENANCE-MISMATCH - Snapshot lastCommittedEventId not matching the latest history eventId must throw error
[CATEGORY]: SECTION E: Hydration Integrity
[CALLING_PATH]: SovereignEngine.hydrate(tamperedSnapshot, validHistory)
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
    "[HYDRATION_INTEGRITY_VIOLATION] Snapshot lastCommittedEventId 'evt-ghost-999' does not match last history eventId 'evt-hyd-seed'."
  ]
}

[COMMIT]
NOT REACHED

[AFTER]
{
  "hydrated": false,
  "error": "[HYDRATION_INTEGRITY_VIOLATION] Snapshot lastCommittedEventId 'evt-ghost-999' does not match last history eventId 'evt-hyd-seed'.",
  "fallback": "CREATION_MODE_TRIGGERED"
}

[DELTA_SUMMARY]
- Canonical State: stateVersion: 1 -> undefined, lastCommittedEventId: null -> undefined
- History: historyLength: 0 -> undefined (+NaN records)
[VERDICT]: FAIL


--------------------------------------------------
[TEST_ID]: E-7-HYDRATE-LEGACY-NULL-COMPATIBILITY - Legacy null fields in snapshot must be safely hydrated without crashes
[CATEGORY]: SECTION E: Hydration Integrity
[CALLING_PATH]: SovereignEngine.hydrate(legacySnapshot, legacyHistory)
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
  "isValid": true
}

[COMMIT]
{
  "success": true,
  "stateVersion": 1
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedAt": "2026-08-23T13:58:20.027Z",
  "lastCommittedEventId": "evt-legacy-1",
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
    "inventory": [
      {
        "id": "item-legacy",
        "name": "고서",
        "quantity": 1
      }
    ],
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
      "recordId": "rec-legacy-1",
      "eventId": "evt-legacy-1",
      "requestId": "req-legacy-1",
      "proposalId": "prop-legacy-1",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "source": "PLAYER",
      "actionType": "SET_WORLD_METADATA",
      "details": "{}",
      "stateVersionAfterCommit": 1,
      "informationAccess": "PUBLIC"
    }
  ],
  "diagnostics": {
    "stateVersion": 1,
    "totalExecutedRequests": 2,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-legacy-1"
  }
}

[DELTA_SUMMARY]
- Canonical State: No State Mutation (Preserved Exactly)
- History: historyLength: 0 -> 1 (+1 records)
[VERDICT]: FAIL


--------------------------------------------------
[TEST_ID]: E-8-HYDRATE-MULTI-ACTION-SAME-EVENT-SEMANTICS - Multiple actions sharing eventId and stateVersion from the same proposal MUST hydrate successfully as normal semantics
[CATEGORY]: SECTION E: Hydration Integrity
[CALLING_PATH]: SovereignEngine.hydrate(multiSnapshot, multiActionHistory)
--------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedAt": "2026-08-23T13:58:19.035Z",
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
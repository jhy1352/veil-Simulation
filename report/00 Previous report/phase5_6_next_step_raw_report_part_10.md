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
  "lastCommittedEventId": "evt-multi-same-proposal",
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
  "historyLength": 2,
  "history": [
    {
      "recordId": "rec-multi-1",
      "eventId": "evt-multi-same-proposal",
      "requestId": "req-multi-same",
      "proposalId": "prop-multi-same",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "source": "PLAYER",
      "actionType": "SET_WORLD_METADATA",
      "details": "{\"worldName\":\"Multi\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    },
    {
      "recordId": "rec-multi-2",
      "eventId": "evt-multi-same-proposal",
      "requestId": "req-multi-same",
      "proposalId": "prop-multi-same",
      "turn": 1,
      "timestamp": "2026-08-23T13:58:20.027Z",
      "source": "PLAYER",
      "actionType": "UPDATE_CHARACTER_STATS",
      "details": "{\"strength\":15}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 2,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 2,
    "lastEventId": "evt-multi-same-proposal"
  }
}

[DELTA_SUMMARY]
- Canonical State: stateVersion: 1 -> 2, lastCommittedEventId: null -> evt-multi-same-proposal
- History: historyLength: 0 -> 2 (+2 records)
[VERDICT]: PASS


--------------------------------------------------
[TEST_ID]: E-9-HYDRATE-EMPTY-REGISTRY-SELF-HEALING - Hydration automatically rebuilds executedRequestIds and recordedEventIds from historical records
[CATEGORY]: SECTION E: Hydration Integrity
[CALLING_PATH]: SovereignEngine.hydrate(validSnapshot, validHistory)
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
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 2,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-hyd-seed"
  }
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
[TEST_ID]: E-10-HYDRATE-SNAPSHOT-VERSION-PRECEDING-HISTORY - Snapshot stateVersion lower than history version must throw error and prevent stale hydration
[CATEGORY]: SECTION E: Hydration Integrity
[CALLING_PATH]: SovereignEngine.hydrate(tamperedSnapshot, validHistory)
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
    "[HYDRATION_INTEGRITY_VIOLATION] Snapshot stateVersion (1) precedes last history version (2)."
  ]
}

[COMMIT]
NOT REACHED

[AFTER]
{
  "hydrated": false,
  "error": "[HYDRATION_INTEGRITY_VIOLATION] Snapshot stateVersion (1) precedes last history version (2).",
  "fallback": "CREATION_MODE_TRIGGERED"
}

[DELTA_SUMMARY]
- Canonical State: stateVersion: 1 -> undefined, lastCommittedEventId: null -> undefined
- History: historyLength: 0 -> undefined (+NaN records)
[VERDICT]: FAIL


---

## Section 3: forensicRunner.ts Full RAW Execution Output

```text
=== SECTION 1: INVENTORY IDENTITY (ADD / REMOVE / SET_QUANTITY / RESOURCE_EXCHANGE with ID/Name combinations) ===
[1.1 Initial Inventory]: []
[1.1 ADD same ID different Name result]: success= false rejectedReasons= [
  '[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.',
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:01.000Z' (1787468401000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.195Z' (1787493497195)."
]
[1.1 Inventory after 1-a]: []
[1.2 REMOVE diff ID same Name result]: success= false rejectedReasons= [
  '[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.',
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:02.000Z' (1787468402000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.199Z' (1787493497199)."
]
[1.2 Inventory after REMOVE by name]: []
[1.2 REMOVE same ID diff Name result]: success= false rejectedReasons= [
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:03.000Z' (1787468403000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.199Z' (1787493497199)."
]
[1.2 Inventory after REMOVE by ID]: []
[1.3 LLM SET_QUANTITY 3 -> 10 result]: success= false rejectedReasons= [
  '[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.',
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:04.000Z' (1787468404000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.200Z' (1787493497200)."
]
[1.3 PLAYER SET_QUANTITY 3 -> 0 result]: success= false rejectedReasons= [
  '[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.',
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:05.000Z' (1787468405000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.200Z' (1787493497200)."
]
[1.3 Inventory after SET_QUANTITY]: []
[1.4 RESOURCE_EXCHANGE cost ID mismatch result]: success= false rejectedReasons= [
  '[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.',
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:06.000Z' (1787468406000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.201Z' (1787493497201)."
]
[1.4 Inventory after mismatch exchange]: []

=== SECTION 2: TURN REGRESSION (Attempting commit with proposal turn < snapshot.turn) ===
[2.1 Turn advance to 5]: success= false current snapshot turn= 1 stateVersion= 1
[2.2 Turn regression Validator valid]: undefined rejectedReasons: [
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:15.000Z' (1787468415000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.202Z' (1787493497202)."
]
[2.2 Turn regression Commit success]: false rejectedReasons: [
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:15.000Z' (1787468415000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.202Z' (1787493497202)."
]
[2.2 Snapshot turn after regression attempt]: 1 stateVersion: 1

=== SECTION 3: EVENT TRUST BOUNDARY ===
[3.1 Fake Seed Acquisition]: success= false rejectedReasons= [
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:20.000Z' (1787468420000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.203Z' (1787493497203)."
]
[3.2 Substring verifiedEventId result]: success= false rejectedReasons= [
  '[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.',
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:21.000Z' (1787468421000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.204Z' (1787493497204)."
]
[3.3 CREATE EVENT -> CONSUME in same proposal result]: success= false rejectedReasons= [
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:22.000Z' (1787468422000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.204Z' (1787493497204)."
]
[3.3 Inventory after same-proposal creation]: []
[3.4 PLAYER ADD_NARRATIVE_SEED result]: success= false rejectedReasons= [
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:23.000Z' (1787468423000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.204Z' (1787493497204)."
]

=== SECTION 4: ACTUAL PARSER GOLDEN PATH ("은화를 봤다" vs "은화를 획득했다") ===
[4.1 Parsed Proposal for "은화를 보았다"]: {
  "proposalId": "prop-req-parse-obs",
  "requestId": "req-parse-obs",
  "eventId": "evt-parse-obs",
  "expectedStateVersion": 1,
  "source": "LLM",
  "turn": 1,
  "timestamp": "2026-08-23T13:58:17.205Z",
  "intentSummary": "은화를 바라봄",
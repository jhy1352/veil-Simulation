  "lastHistoryItem": null,
  "totalRecordedEvents": 0,
  "totalExecutedRequests": 0,
  "eventRegistry": [],
  "requestRegistry": []
}

[PROPOSAL]
{
  "proposalId": "prop-sq-2",
  "requestId": "req-sq-2",
  "eventId": "evt-sq-2",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:02.000Z",
  "intentSummary": "PLAYER SET_QUANTITY 5 -> 0",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "SET_QUANTITY",
        "item": {
          "id": "item-silver-2",
          "name": "은화",
          "quantity": 0
        }
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:02.000Z' (1787472002000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.997Z' (1787493498997)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-sq-2",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:02.000Z' (1787472002000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.997Z' (1787493498997)."
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
    "lastCommittedAt": "2026-08-23T13:58:18.997Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:18.997Z",
  "inventory": [],
  "characterStats": {
    "strength": 10,
    "agility": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "npcs": [],
  "factions": [],
  "seeds": [],
  "historyCount": 0,
  "lastHistoryItem": null,
  "totalRecordedEvents": 0,
  "totalExecutedRequests": 0,
  "eventRegistry": [],
  "requestRegistry": []
}
======================================================================


======================================================================
[TEST_RUN]: 1.3-SET_QUANTITY-5toNeg1 - PLAYER SET_QUANTITY 5 -> -1
----------------------------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:18.997Z",
  "inventory": [],
  "characterStats": {
    "strength": 10,
    "agility": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "npcs": [],
  "factions": [],
  "seeds": [],
  "historyCount": 0,
  "lastHistoryItem": null,
  "totalRecordedEvents": 0,
  "totalExecutedRequests": 0,
  "eventRegistry": [],
  "requestRegistry": []
}

[PROPOSAL]
{
  "proposalId": "prop-sq-3",
  "requestId": "req-sq-3",
  "eventId": "evt-sq-3",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:03.000Z",
  "intentSummary": "PLAYER SET_QUANTITY 5 -> -1",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "SET_QUANTITY",
        "item": {
          "id": "item-silver-3",
          "name": "은화",
          "quantity": -1
        }
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:03.000Z' (1787472003000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.997Z' (1787493498997)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-sq-3",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:03.000Z' (1787472003000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.997Z' (1787493498997)."
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
    "lastCommittedAt": "2026-08-23T13:58:18.997Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:18.997Z",
  "inventory": [],
  "characterStats": {
    "strength": 10,
    "agility": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "npcs": [],
  "factions": [],
  "seeds": [],
  "historyCount": 0,
  "lastHistoryItem": null,
  "totalRecordedEvents": 0,
  "totalExecutedRequests": 0,
  "eventRegistry": [],
  "requestRegistry": []
}
======================================================================


======================================================================
[TEST_RUN]: 1.4-SET_QUANTITY-DiffIdSameName - PLAYER SET_QUANTITY Diff ID Same Name
----------------------------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:18.998Z",
  "inventory": [],
  "characterStats": {
    "strength": 10,
    "agility": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "npcs": [],
  "factions": [],
  "seeds": [],
  "historyCount": 0,
  "lastHistoryItem": null,
  "totalRecordedEvents": 0,
  "totalExecutedRequests": 0,
  "eventRegistry": [],
  "requestRegistry": []
}

[PROPOSAL]
{
  "proposalId": "prop-sq-4",
  "requestId": "req-sq-4",
  "eventId": "evt-sq-4",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:04.000Z",
  "intentSummary": "PLAYER SET_QUANTITY with matching Name but different ID",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "SET_QUANTITY",
        "item": {
          "id": "item-different-id",
          "name": "은화",
          "quantity": 2
        }
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:04.000Z' (1787472004000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.998Z' (1787493498998)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-sq-4",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:04.000Z' (1787472004000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.998Z' (1787493498998)."
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
    "lastCommittedAt": "2026-08-23T13:58:18.998Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:18.998Z",
  "inventory": [],
  "characterStats": {
    "strength": 10,
    "agility": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "npcs": [],
  "factions": [],
  "seeds": [],
  "historyCount": 0,
  "lastHistoryItem": null,
  "totalRecordedEvents": 0,
  "totalExecutedRequests": 0,
  "eventRegistry": [],
  "requestRegistry": []
}
======================================================================


======================================================================
[TEST_RUN]: 1.5-SET_QUANTITY-SameIdDiffName - PLAYER SET_QUANTITY Same ID Diff Name
----------------------------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:18.998Z",
  "inventory": [],
  "characterStats": {
    "strength": 10,
    "agility": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "npcs": [],
  "factions": [],
  "seeds": [],
  "historyCount": 0,
  "lastHistoryItem": null,
  "totalRecordedEvents": 0,
  "timestamp": "2026-08-23T08:00:01.000Z",
  "intentSummary": "Resolve seed targeting non-existent ID",
  "actions": [
    {
      "type": "RESOLVE_NARRATIVE_SEED",
      "payload": {
        "id": "seed-nonexistent",
        "resolutionSummary": "해결됨"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:01.000Z' (1787472001000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.001Z' (1787493499001)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-seed-1",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:01.000Z' (1787472001000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.001Z' (1787493499001)."
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
    "lastCommittedAt": "2026-08-23T13:58:19.001Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:19.001Z",
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
[TEST_RUN]: 6.1-VERIFIED_EVENT_ID-PREFIX - verifiedEventId prefix match attack
----------------------------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:19.001Z",
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
  "proposalId": "prop-adv-pre",
  "requestId": "req-adv-pre",
  "eventId": "evt-adv-pre",
  "expectedStateVersion": 2,
  "source": "LLM",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:02.000Z",
  "intentSummary": "Prefix match attack on verifiedEventId",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": {
          "id": "item-ginseng",
          "name": "천년설삼",
          "quantity": 1
        },
        "acquisition": {
          "cause": "DISCOVERY_PICKUP",
          "verifiedEventId": "seed-target"
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
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:02.000Z' (1787472002000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.001Z' (1787493499001)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-adv-pre",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:02.000Z' (1787472002000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.001Z' (1787493499001)."
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
    "lastCommittedAt": "2026-08-23T13:58:19.001Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:19.001Z",
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
[TEST_RUN]: 6.2-VERIFIED_EVENT_ID-SUFFIX - verifiedEventId suffix match attack
----------------------------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:19.001Z",
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
  "proposalId": "prop-adv-suf",
  "requestId": "req-adv-suf",
  "eventId": "evt-adv-suf",
  "expectedStateVersion": 2,
  "source": "LLM",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:03.000Z",
  "intentSummary": "Suffix match attack on verifiedEventId",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": {
          "id": "item-ginseng",
          "name": "천년설삼",
          "quantity": 1
        },
        "acquisition": {
          "cause": "DISCOVERY_PICKUP",
          "verifiedEventId": "12345"
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
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:03.000Z' (1787472003000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.001Z' (1787493499001)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-adv-suf",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:03.000Z' (1787472003000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.001Z' (1787493499001)."
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
    "lastCommittedAt": "2026-08-23T13:58:19.001Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:19.001Z",
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


```

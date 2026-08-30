  "totalExecutedRequests": 0,
  "eventRegistry": [],
  "requestRegistry": []
}

[PROPOSAL]
{
  "proposalId": "prop-corr-1",
  "requestId": "req-corr-1",
  "eventId": "evt-corr-1",
  "expectedStateVersion": 1,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:00.000Z",
  "intentSummary": "Stat change and impression update",
  "actions": [
    {
      "type": "UPDATE_CHARACTER_STATS",
      "payload": {
        "strength": 15
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:00.000Z' (1787472000000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.000Z' (1787493499000)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-corr-1",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:00.000Z' (1787472000000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.000Z' (1787493499000)."
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
    "lastCommittedAt": "2026-08-23T13:58:19.000Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:19.000Z",
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
[TEST_RUN]: 5.1-NPC-WRONG-ID - UPDATE_NPC targeting non-existent ID
----------------------------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:19.000Z",
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
  "proposalId": "prop-npc-1",
  "requestId": "req-npc-1",
  "eventId": "evt-npc-1",
  "expectedStateVersion": 2,
  "source": "LLM",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:01.000Z",
  "intentSummary": "Update NPC targeting wrong ID",
  "actions": [
    {
      "type": "UPDATE_NPC",
      "payload": {
        "id": "npc-wrong-id",
        "changes": {
          "relationship": "FRIENDLY"
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
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:01.000Z' (1787472001000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.000Z' (1787493499000)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-npc-1",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:01.000Z' (1787472001000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.000Z' (1787493499000)."
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
    "lastCommittedAt": "2026-08-23T13:58:19.000Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:19.000Z",
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
[TEST_RUN]: 5.2-FACTION-WRONG-ID - UPDATE_FACTION targeting non-existent ID
----------------------------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:19.000Z",
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
  "proposalId": "prop-fac-1",
  "requestId": "req-fac-1",
  "eventId": "evt-fac-1",
  "expectedStateVersion": 2,
  "source": "LLM",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:01.000Z",
  "intentSummary": "Update Faction targeting non-existent ID",
  "actions": [
    {
      "type": "UPDATE_FACTION",
      "payload": {
        "id": "fac-shaolin",
        "changes": {
          "reputation": "HONORED"
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
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:01.000Z' (1787472001000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.000Z' (1787493499000)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-fac-1",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:01.000Z' (1787472001000) cannot be earlier than last committed timestamp '2026-08-23T13:58:19.000Z' (1787493499000)."
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
    "lastCommittedAt": "2026-08-23T13:58:19.000Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:19.000Z",
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
[TEST_RUN]: 5.3-SEED-WRONG-ID - RESOLVE_NARRATIVE_SEED targeting non-existent ID
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
  "proposalId": "prop-seed-1",
  "requestId": "req-seed-1",
  "eventId": "evt-seed-1",
  "expectedStateVersion": 2,
  "source": "LLM",
  "turn": 1,
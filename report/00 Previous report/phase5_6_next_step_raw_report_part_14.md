  "totalExecutedRequests": 0,
  "eventRegistry": [],
  "requestRegistry": []
}

[PROPOSAL]
{
  "proposalId": "prop-sq-5",
  "requestId": "req-sq-5",
  "eventId": "evt-sq-5",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:05.000Z",
  "intentSummary": "PLAYER SET_QUANTITY with matching ID but different Name",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "SET_QUANTITY",
        "item": {
          "id": "item-silver-orig",
          "name": "금화",
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
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:05.000Z' (1787472005000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.998Z' (1787493498998)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-sq-5",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:05.000Z' (1787472005000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.998Z' (1787493498998)."
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
[TEST_RUN]: 2.1-TIMESTAMP-REGRESSION - Proposal with past timestamp (1999 vs 2026)
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
  "proposalId": "prop-time-past",
  "requestId": "req-time-past",
  "eventId": "evt-time-past",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "1999-01-01T00:00:00.000Z",
  "intentSummary": "Past timestamp regression attempt",
  "actions": [
    {
      "type": "ADD_NARRATIVE_SEED",
      "payload": {
        "id": "seed-past-1",
        "content": "과거 시드",
        "status": "active"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '1999-01-01T00:00:00.000Z' (915148800000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.998Z' (1787493498998)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-time-past",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '1999-01-01T00:00:00.000Z' (915148800000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.998Z' (1787493498998)."
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
[TEST_RUN]: 3.1-HYDRATE-TAMPERED-TURN - Hydrated with tampered turn=999, submit turn=1
----------------------------------------------------------------------
[BEFORE]
{
  "turn": 999,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:18.999Z",
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
  "proposalId": "prop-hyd-turn",
  "requestId": "req-hyd-turn",
  "eventId": "evt-hyd-turn",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:10.000Z",
  "intentSummary": "Turn 1 against tampered turn 999",
  "actions": [
    {
      "type": "UPDATE_CHARACTER_STATS",
      "payload": {
        "hp": 95
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TURN_REGRESSION_CONFLICT] Proposal turn 1 cannot regress behind current sovereign turn 999.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:10.000Z' (1787472010000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.999Z' (1787493498999)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-hyd-turn",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TURN_REGRESSION_CONFLICT] Proposal turn 1 cannot regress behind current sovereign turn 999.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:10.000Z' (1787472010000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.999Z' (1787493498999)."
  ],
  "conflictDetails": [],
  "newHistoricalRecords": [],
  "snapshot": {
    "stateVersion": 1,
    "turn": 999,
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
    "lastCommittedAt": "2026-08-23T13:58:18.999Z"
  }
}

[AFTER]
{
  "turn": 999,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:18.999Z",
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
[TEST_RUN]: 3.2-HYDRATE-FORGED-HISTORY - Hydrated with forged history entry
----------------------------------------------------------------------
[HYDRATION_REJECTION_CAUGHT]: [HYDRATION_INTEGRITY_VIOLATION] Snapshot stateVersion (1) precedes last history version (3).
[VERDICT]: PASS (Sovereign Hydration Integrity Firewall successfully blocked corrupted state)
======================================================================


======================================================================
[TEST_RUN]: 4.1-HISTORY-STATE-CORRESPONDENCE - Verify exact correspondence of State changes and History records
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
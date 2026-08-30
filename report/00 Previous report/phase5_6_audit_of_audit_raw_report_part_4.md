# TRPG 3.1 — Phase 5.6 Audit-of-Audit Raw Execution Report (Part 4/5)

> Lines 1501 ~ 2000 of 2303

```json
  "stateVersion": 1,
  "turn": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T16:45:47.071Z",
  "character": {
    "name": "주인공",
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
    "worldName": "보안경계세계",
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
  "proposalId": "prop-test7-forged",
  "requestId": "req-test7-forged",
  "eventId": "evt-test7-forged",
  "expectedStateVersion": 1,
  "source": "SYSTEM",
  "turn": 1,
  "timestamp": "2026-08-23T16:45:47.071Z",
  "intentSummary": "Forged system proposal attack",
  "actions": [
    {
      "type": "SET_WORLD_METADATA",
      "payload": {
        "worldName": "해킹된세계"
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[SECURITY_FORGERY] Direct submission of privileged source 'SYSTEM' without Engine-owned capability token is strictly rejected."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
NOT REACHED

[AFTER]
{
  "stateVersion": 1,
  "turn": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T16:45:47.071Z",
  "character": {
    "name": "주인공",
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
    "worldName": "보안경계세계",
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

[STATE COMPARISON]
Is Identical: true
Diffs: NONE (100% Immutable)
Notes: Direct submission of SYSTEM source without isEngineAuthorized token was caught and blocked with [SECURITY_FORGERY].

--------------------------------------------------------------------------------
[CASE-08] INVENTORY CAUSALITY: DUPLICATE VERIFIED EVENT ID REUSE BLOCKED
Category: Inventory Causality & Double-Spend Defense
Verdict: [PASS]
--------------------------------------------------------------------------------

[BEFORE]
{
  "stateVersion": 2,
  "turn": 1,
  "lastCommittedEventId": "evt-test8-legit",
  "lastCommittedAt": "2026-08-23T16:45:47.072Z",
  "character": {
    "name": "주인공",
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
        "id": "item-scale",
        "name": "드래곤의 비늘",
        "quantity": 1
      }
    ],
    "secret": "",
    "physicalDefect": "",
    "timeline": []
  },
  "worldInfo": {
    "worldName": "인과율세계",
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
    "seeds": [
      {
        "id": "seed-dragon-scale",
        "content": "드래곤의 비늘 획득 단서",
        "status": "active"
      }
    ],
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
      "recordId": "rec-evt-test8-legit-1",
      "eventId": "evt-test8-legit",
      "requestId": "req-test8-legit",
      "proposalId": "prop-test8-legit",
      "actionType": "MODIFY_INVENTORY",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"item\":{\"id\":\"item-scale\",\"name\":\"드래곤의 비늘\",\"quantity\":1},\"operation\":\"ADD\",\"acquisition\":{\"cause\":\"DISCOVERY_PICKUP\",\"verifiedEventId\":\"seed-dragon-scale\"}}"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-test8-legit"
  }
}

[PROPOSAL]
{
  "proposalId": "prop-test8-attack-duplicate",
  "requestId": "req-test8-attack-duplicate",
  "eventId": "evt-test8-attack-duplicate",
  "expectedStateVersion": 2,
  "source": "LLM",
  "turn": 1,
  "timestamp": "2026-08-23T16:45:48.072Z",
  "intentSummary": "Duplicate consumption of verifiedEventId attack",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "item": {
          "id": "item-scale-2",
          "name": "드래곤의 비늘",
          "quantity": 5
        },
        "operation": "ADD",
        "acquisition": {
          "cause": "DISCOVERY_PICKUP",
          "verifiedEventId": "seed-dragon-scale"
        }
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[CAUSALITY_VIOLATION] Duplicate consumption of event 'seed-dragon-scale'."
  ],
  "conflictDetails": [
    "[CAUSALITY_VIOLATION] Action #1: Event 'seed-dragon-scale' has already been consumed for item acquisition."
  ],
  "sanitizedActions": []
}

[COMMIT]
NOT REACHED

[AFTER]
{
  "stateVersion": 2,
  "turn": 1,
  "lastCommittedEventId": "evt-test8-legit",
  "lastCommittedAt": "2026-08-23T16:45:47.072Z",
  "character": {
    "name": "주인공",
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
        "id": "item-scale",
        "name": "드래곤의 비늘",
        "quantity": 1
      }
    ],
    "secret": "",
    "physicalDefect": "",
    "timeline": []
  },
  "worldInfo": {
    "worldName": "인과율세계",
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
    "seeds": [
      {
        "id": "seed-dragon-scale",
        "content": "드래곤의 비늘 획득 단서",
        "status": "active"
      }
    ],
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
      "recordId": "rec-evt-test8-legit-1",
      "eventId": "evt-test8-legit",
      "requestId": "req-test8-legit",
      "proposalId": "prop-test8-legit",
      "actionType": "MODIFY_INVENTORY",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"item\":{\"id\":\"item-scale\",\"name\":\"드래곤의 비늘\",\"quantity\":1},\"operation\":\"ADD\",\"acquisition\":{\"cause\":\"DISCOVERY_PICKUP\",\"verifiedEventId\":\"seed-dragon-scale\"}}"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 1,
    "lastEventId": "evt-test8-legit"
  }
}

[STATE COMPARISON]
Is Identical: true
Diffs: NONE (100% Immutable)
Notes: EngineValidator verified history records, detected verifiedEventId seed-dragon-scale was already consumed, and blocked unbacked creation.

--------------------------------------------------------------------------------
[CASE-09] DEAD NPC RESURRECTION VIA WORLD OVERWRITE BLOCKED
Category: Permanent Mortality & Entity Immutability
Verdict: [PASS]
--------------------------------------------------------------------------------

[BEFORE]
{
  "stateVersion": 1,
  "turn": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T16:45:47.073Z",
  "character": {
    "name": "주인공",
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
    "worldName": "생사불변세계",
    "worldType": "popular_genre",
    "settingDescription": "",
    "toneStyle": "원작 고유의 문체 충실 재현",
    "currentTime": {
      "year": 1,
      "season": "SPRING",
      "formattedTime": "1년 봄"
    },
    "npcs": [
      {
        "id": "npc-boss-1",
        "name": "악당 두목",
        "status": "DEAD",
        "relationship": "적대"
      }
    ],
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

```

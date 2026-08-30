# TRPG 3.1 — Phase 5.6 Audit-of-Audit Raw Execution Report (Part 5/5)

> Lines 2001 ~ 2303 of 2303

```json
[PROPOSAL]
{
  "proposalId": "prop-test9-revive",
  "requestId": "req-test9-revive",
  "eventId": "evt-test9-revive",
  "expectedStateVersion": 1,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T16:45:47.073Z",
  "intentSummary": "Revive dead NPC attack via OVERWRITE_WORLD_INFO",
  "actions": [
    {
      "type": "OVERWRITE_WORLD_INFO",
      "payload": {
        "worldName": "생사불변세계",
        "npcs": [
          {
            "id": "npc-boss-1",
            "name": "악당 두목",
            "status": "ALIVE",
            "relationship": "동맹"
          }
        ]
      }
    }
  ]
}

[VALIDATOR]
{
  "isValid": false,
  "rejectedReasons": [
    "[DEAD_NPC_STATUS_PROTECTION] Cannot revive dead NPC via standard status update or world overwrite."
  ],
  "conflictDetails": [
    "[DEAD_NPC_STATUS_PROTECTION] Action #1: Cannot alter status of historically DEAD NPC '악당 두목' (npc-boss-1) to 'ALIVE' via OVERWRITE_WORLD_INFO."
  ],
  "sanitizedActions": []
}

[COMMIT]
NOT REACHED

[AFTER]
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

[STATE COMPARISON]
Is Identical: true
Diffs: NONE (100% Immutable)
Notes: EngineValidator inspected deadNpcIds from state & history and blocked revival attempt with [DEAD_NPC_STATUS_PROTECTION].

--------------------------------------------------------------------------------
[CASE-10] CANONICAL SNAPSHOT DEEP-FREEZE IMMUTABILITY AGAINST DIRECT MUTATION
Category: Direct Mutation & Architectural Bypass Defense
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
    "inventory": [
      {
        "id": "inv-orig",
        "name": "원형검",
        "quantity": 1
      }
    ],
    "secret": "",
    "physicalDefect": "",
    "timeline": []
  },
  "worldInfo": {
    "worldName": "직접변조방어세계",
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
  "directMutationAttempt": "stateVersion=999, worldName=외부변조세계, inventory.push(해킹검)"
}

[VALIDATOR]
{
  "isFrozen": true,
  "isCharacterFrozen": true
}

[COMMIT]
BLOCKED BY DEEP-FREEZE: Cannot assign to read only property 'stateVersion' of object '#<Object>'

[AFTER]
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
    "inventory": [
      {
        "id": "inv-orig",
        "name": "원형검",
        "quantity": 1
      }
    ],
    "secret": "",
    "physicalDefect": "",
    "timeline": []
  },
  "worldInfo": {
    "worldName": "직접변조방어세계",
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
Notes: getSnapshot returns a deepFreeze object, preventing UI/API/Persistence from mutating engine state outside submitProposal Commit Gate.


```

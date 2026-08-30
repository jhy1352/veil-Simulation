# TRPG 3.1 — Phase 5.6 Audit-of-Audit Raw Execution Report (Part 3/5)

> Lines 1001 ~ 1500 of 2303

```json
      "source": "LLM",
      "actionType": "ADD_RUMOR",
      "details": "{\"rumor\":\"소문: 북쪽 산맥에 고룡이 깨어났다.\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "RUMOR"
    },
    {
      "recordId": "rec-evt-test5-shared-id-3",
      "eventId": "evt-test5-shared-id",
      "requestId": "req-test5-multi",
      "proposalId": "prop-test5-multi",
      "turn": 1,
      "timestamp": "2026-08-23T16:45:47.070Z",
      "narrativeTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "source": "LLM",
      "actionType": "ADD_NARRATIVE_SEED",
      "details": "{\"id\":\"seed-test5-dragon\",\"content\":\"북쪽 산맥의 고룡 수색\",\"status\":\"active\"}",
      "stateVersionAfterCommit": 2,
      "informationAccess": "PUBLIC"
    }
  ],
  "snapshot": {
    "stateVersion": 2,
    "turn": 1,
    "worldInfo": {
      "worldName": "진보한세계",
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
      "publicRumors": [
        "소문: 북쪽 산맥에 고룡이 깨어났다."
      ],
      "secretLore": [],
      "seeds": [
        {
          "id": "seed-test5-dragon",
          "content": "북쪽 산맥의 고룡 수색",
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
          "id": "inv-1",
          "name": "은화",
          "quantity": 20
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "lastCommittedEventId": "evt-test5-shared-id",
    "lastCommittedAt": "2026-08-23T16:45:47.070Z"
  }
}

[AFTER]
{
  "stateVersion": 2,
  "turn": 1,
  "lastCommittedEventId": "evt-test5-shared-id",
  "lastCommittedAt": "2026-08-23T16:45:47.070Z",
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
        "id": "inv-1",
        "name": "은화",
        "quantity": 20
      }
    ],
    "secret": "",
    "physicalDefect": "",
    "timeline": []
  },
  "worldInfo": {
    "worldName": "진보한세계",
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
    "publicRumors": [
      "소문: 북쪽 산맥에 고룡이 깨어났다."
    ],
    "secretLore": [],
    "seeds": [
      {
        "id": "seed-test5-dragon",
        "content": "북쪽 산맥의 고룡 수색",
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
  "historyLength": 3,
  "history": [
    {
      "recordId": "rec-evt-test5-shared-id-1",
      "eventId": "evt-test5-shared-id",
      "requestId": "req-test5-multi",
      "proposalId": "prop-test5-multi",
      "actionType": "SET_WORLD_METADATA",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"worldName\":\"진보한세계\"}"
    },
    {
      "recordId": "rec-evt-test5-shared-id-2",
      "eventId": "evt-test5-shared-id",
      "requestId": "req-test5-multi",
      "proposalId": "prop-test5-multi",
      "actionType": "ADD_RUMOR",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"rumor\":\"소문: 북쪽 산맥에 고룡이 깨어났다.\"}"
    },
    {
      "recordId": "rec-evt-test5-shared-id-3",
      "eventId": "evt-test5-shared-id",
      "requestId": "req-test5-multi",
      "proposalId": "prop-test5-multi",
      "actionType": "ADD_NARRATIVE_SEED",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"id\":\"seed-test5-dragon\",\"content\":\"북쪽 산맥의 고룡 수색\",\"status\":\"active\"}"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 3,
    "lastEventId": "evt-test5-shared-id"
  }
}

[STATE COMPARISON]
Is Identical: false
Diffs: stateVersion changed: 1 -> 2, lastCommittedEventId changed: null -> evt-test5-shared-id, historyLength changed: 0 -> 3, worldInfo mutated
Notes: A single atomic proposal generated 3 distinct immutable records sharing the exact same eventId, incrementing stateVersion exactly once.

--------------------------------------------------------------------------------
[CASE-06] HYDRATION PRESERVES VALID MULTI-ACTION SHARED EVENT ID HISTORY
Category: Persistence & Hydration Integrity
Verdict: [PASS]
--------------------------------------------------------------------------------

[BEFORE]
{
  "stateVersion": 2,
  "turn": 1,
  "lastCommittedEventId": "evt-test6-shared",
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
    "worldName": "하이드레이션완료세계",
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
    "publicRumors": [
      "상단이 도착했다."
    ],
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
      "recordId": "rec-evt-test6-shared-1",
      "eventId": "evt-test6-shared",
      "requestId": "req-test6-multi",
      "proposalId": "prop-test6-multi",
      "actionType": "SET_WORLD_METADATA",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"worldName\":\"하이드레이션완료세계\"}"
    },
    {
      "recordId": "rec-evt-test6-shared-2",
      "eventId": "evt-test6-shared",
      "requestId": "req-test6-multi",
      "proposalId": "prop-test6-multi",
      "actionType": "ADD_RUMOR",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"rumor\":\"상단이 도착했다.\"}"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 1,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 2,
    "lastEventId": "evt-test6-shared"
  }
}

[PROPOSAL]
{
  "snapshot": {
    "stateVersion": 2,
    "turn": 1,
    "worldInfo": {
      "worldName": "하이드레이션완료세계",
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
      "publicRumors": [
        "상단이 도착했다."
      ],
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
    "lastCommittedEventId": "evt-test6-shared",
    "lastCommittedAt": "2026-08-23T16:45:47.071Z"
  },
  "historyCount": 2
}

[VALIDATOR]
{
  "isValid": true,
  "error": null
}

[COMMIT]
HYDRATED SUCCESSFULLY

[AFTER]
{
  "stateVersion": 2,
  "turn": 1,
  "lastCommittedEventId": "evt-test6-shared",
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
    "worldName": "하이드레이션완료세계",
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
    "publicRumors": [
      "상단이 도착했다."
    ],
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
      "recordId": "rec-evt-test6-shared-1",
      "eventId": "evt-test6-shared",
      "requestId": "req-test6-multi",
      "proposalId": "prop-test6-multi",
      "actionType": "SET_WORLD_METADATA",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"worldName\":\"하이드레이션완료세계\"}"
    },
    {
      "recordId": "rec-evt-test6-shared-2",
      "eventId": "evt-test6-shared",
      "requestId": "req-test6-multi",
      "proposalId": "prop-test6-multi",
      "actionType": "ADD_RUMOR",
      "stateVersionAfterCommit": 2,
      "turn": 1,
      "details": "{\"rumor\":\"상단이 도착했다.\"}"
    }
  ],
  "diagnostics": {
    "stateVersion": 2,
    "totalExecutedRequests": 2,
    "totalRecordedEvents": 1,
    "totalHistoricalRecords": 2,
    "lastEventId": "evt-test6-shared"
  }
}

[STATE COMPARISON]
Is Identical: true
Diffs: NONE (100% Immutable)
Notes: Hydration correctly ingested multi-action records with shared eventIds without false-positive replay rejections.

--------------------------------------------------------------------------------
[CASE-07] FORGED PRIVILEGED SYSTEM SOURCE SUBMISSION BLOCKED
Category: Capability Security & Source Authority
Verdict: [PASS]
--------------------------------------------------------------------------------

[BEFORE]
{
```

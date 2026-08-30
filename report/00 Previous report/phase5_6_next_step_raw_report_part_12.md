      "lastEventId": null,
      "totalRecordedEvents": 0,
      "totalExecutedRequests": 0,
      "eventRegistry": [],
      "requestRegistry": []
    },
    "pass": false,
    "actualSummary": "success=false, distinctSlots=0, totalQty=0, slotDetails=[]"
  },
  {
    "testId": "TEST-G",
    "testName": "Non-existent Item REMOVE -> Change 0",
    "before": {
      "turn": 1,
      "stateVersion": 1,
      "inventory": [],
      "historyCount": 0,
      "lastEventId": null,
      "totalRecordedEvents": 0,
      "totalExecutedRequests": 0,
      "eventRegistry": [],
      "requestRegistry": []
    },
    "proposal": {
      "proposalId": "prop-rem-g",
      "requestId": "req-rem-g",
      "eventId": "evt-rem-g",
      "expectedStateVersion": 2,
      "source": "PLAYER",
      "turn": 1,
      "timestamp": "2026-08-23T06:30:05.000Z",
      "intentSummary": "Attempt to remove non-existent potion",
      "actions": [
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "REMOVE",
            "item": {
              "id": "item-potion-unknown",
              "name": "신비한 영약",
              "quantity": 1
            }
          }
        }
      ]
    },
    "validatorResult": {
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.044Z' (1787493498044)."
      ]
    },
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.044Z' (1787493498044)."
      ],
      "committedActionsCount": 0
    },
    "after": {
      "turn": 1,
      "stateVersion": 1,
      "inventory": [],
      "historyCount": 0,
      "lastEventId": null,
      "totalRecordedEvents": 0,
      "totalExecutedRequests": 0,
      "eventRegistry": [],
      "requestRegistry": []
    },
    "pass": false,
    "actualSummary": "success=false, rejectedReasons=[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.; [TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.044Z' (1787493498044)., stateVersion=1 (before=1)"
  },
  {
    "testId": "TEST-H",
    "testName": "Action Order & Atomicity: REMOVE -> ADD Exchange",
    "before": {
      "turn": 1,
      "stateVersion": 1,
      "inventory": [],
      "historyCount": 0,
      "lastEventId": null,
      "totalRecordedEvents": 0,
      "totalExecutedRequests": 0,
      "eventRegistry": [],
      "requestRegistry": []
    },
    "proposal": {
      "proposalId": "prop-exch-h",
      "requestId": "req-exch-h",
      "eventId": "evt-exch-h",
      "expectedStateVersion": 2,
      "source": "PLAYER",
      "turn": 1,
      "timestamp": "2026-08-23T06:30:05.000Z",
      "intentSummary": "Exchange 5 silver for martial manual",
      "actions": [
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "REMOVE",
            "item": {
              "id": "item-silver",
              "name": "은화",
              "quantity": 5
            }
          }
        },
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "ADD",
            "item": {
              "id": "item-manual",
              "name": "태극권보",
              "quantity": 1
            },
            "acquisition": {
              "cause": "RESOURCE_EXCHANGE",
              "cost": {
                "id": "item-silver",
                "name": "은화",
                "quantity": 5
              }
            }
          }
        }
      ]
    },
    "validatorResult": {
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.044Z' (1787493498044)."
      ]
    },
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.044Z' (1787493498044)."
      ],
      "committedActionsCount": 0
    },
    "after": {
      "turn": 1,
      "stateVersion": 1,
      "inventory": [],
      "historyCount": 0,
      "lastEventId": null,
      "totalRecordedEvents": 0,
      "totalExecutedRequests": 0,
      "eventRegistry": [],
      "requestRegistry": []
    },
    "pass": false,
    "actualSummary": "success=false, silverRemaining=0, manualQuantity=undefined, stateVersion=1"
  },
  {
    "testId": "TEST-I",
    "testName": "Double-Spending Defense: Reusing Same Acquisition Event 2 Times",
    "before": {
      "turn": 1,
      "stateVersion": 1,
      "inventory": [],
      "historyCount": 0,
      "lastEventId": null,
      "totalRecordedEvents": 0,
      "totalExecutedRequests": 0,
      "eventRegistry": [],
      "requestRegistry": []
    },
    "proposal": {
      "proposalId": "prop-acq-i-2",
      "requestId": "req-acq-i-2",
      "eventId": "evt-acq-i-2",
      "expectedStateVersion": 3,
      "source": "LLM",
      "turn": 1,
      "timestamp": "2026-08-23T06:30:10.000Z",
      "intentSummary": "Second pickup attempting double-spend of seed-unique-chest",
      "actions": [
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "ADD",
            "item": {
              "id": "item-book-2",
              "name": "독고구검",
              "quantity": 1
            },
            "acquisition": {
              "cause": "DISCOVERY_PICKUP",
              "verifiedEventId": "seed-unique-chest"
            }
          }
        }
      ]
    },
    "validatorResult": {
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 3, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:10.000Z' (1787466610000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.044Z' (1787493498044)."
      ]
    },
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 3, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:10.000Z' (1787466610000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.044Z' (1787493498044)."
      ],
      "committedActionsCount": 0
    },
    "after": {
      "turn": 1,
      "stateVersion": 1,
      "inventory": [],
      "historyCount": 0,
      "lastEventId": null,
      "totalRecordedEvents": 0,
      "totalExecutedRequests": 0,
      "eventRegistry": [],
      "requestRegistry": []
    },
    "pass": true,
    "actualSummary": "success=false, rejectedReasons=[STALE_STATE_CONFLICT] Proposal expected state version 3, but current sovereign state is at version 1.; [TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:10.000Z' (1787466610000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.044Z' (1787493498044)., stateVersion=1 (before=1), hasBook2=false"
  },
  {
    "testId": "TEST-J",
    "testName": "SAVE -> HYDRATE -> Duplicate Replay Defense -> Change 0",
    "before": {
      "turn": 1,
      "stateVersion": 1,
      "inventory": [],
      "historyCount": 0,
      "lastEventId": null,
      "totalRecordedEvents": 0,
      "totalExecutedRequests": 0,
      "eventRegistry": [],
      "requestRegistry": []
    },
    "proposal": {
      "proposalId": "prop-replay-j",
      "requestId": "req-legit-j",
      "eventId": "evt-legit-j",
      "expectedStateVersion": 1,
      "source": "LLM",
      "turn": 1,
      "timestamp": "2026-08-23T06:30:10.000Z",
      "intentSummary": "Adversarial replay attack on hydrated session",
      "actions": [
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "ADD",
            "item": {
              "id": "item-dan",
              "name": "대환단",
              "quantity": 1
            },
            "acquisition": {
              "cause": "GIFT_REWARD",
              "verifiedEventId": "seed-j"
            }
          }
        }
      ]
    },
    "validatorResult": {
      "rejectedReasons": [
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:10.000Z' (1787466610000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.046Z' (1787493498046)."
      ]
    },
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "rejectedReasons": [
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:10.000Z' (1787466610000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.046Z' (1787493498046)."
      ],
      "committedActionsCount": 0
    },
    "after": {
      "turn": 1,
      "stateVersion": 1,
      "inventory": [],
      "historyCount": 0,
      "lastEventId": null,
      "totalRecordedEvents": 0,
      "totalExecutedRequests": 0,
      "eventRegistry": [],
      "requestRegistry": []
    },
    "pass": false,
    "actualSummary": "success=false, rejectedReasons=[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:10.000Z' (1787466610000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.046Z' (1787493498046)., stateVersion=1 (before=1), danQuantity=undefined"
  }
]

```

---

## Section 5: detailedForensics.ts Full RAW Execution Output

```text
######################################################################
TRPG 3.1 Sovereign Engine: Detailed Behavioral Forensic Suite
######################################################################


======================================================================
[TEST_RUN]: 1.1-SET_QUANTITY-5to7 - PLAYER SET_QUANTITY 5 -> 7 (Same ID, Same Name)
----------------------------------------------------------------------
[BEFORE]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:18.993Z",
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
  "proposalId": "prop-sq-1",
  "requestId": "req-sq-1",
  "eventId": "evt-sq-1",
  "expectedStateVersion": 2,
  "source": "PLAYER",
  "turn": 1,
  "timestamp": "2026-08-23T08:00:01.000Z",
  "intentSummary": "PLAYER SET_QUANTITY 5 -> 7",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "SET_QUANTITY",
        "item": {
          "id": "item-silver-1",
          "name": "은화",
          "quantity": 7
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
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:01.000Z' (1787472001000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.993Z' (1787493498993)."
  ],
  "conflictDetails": [],
  "sanitizedActions": []
}

[COMMIT]
{
  "success": false,
  "stateVersion": 1,
  "eventId": "evt-sq-1",
  "committedActionsCount": 0,
  "rejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
    "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T08:00:01.000Z' (1787472001000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.993Z' (1787493498993)."
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
    "lastCommittedAt": "2026-08-23T13:58:18.993Z"
  }
}

[AFTER]
{
  "turn": 1,
  "stateVersion": 1,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-23T13:58:18.993Z",
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
[TEST_RUN]: 1.2-SET_QUANTITY-5to0 - PLAYER SET_QUANTITY 5 -> 0
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
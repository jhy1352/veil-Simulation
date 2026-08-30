  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": {
          "id": "item-silver",
          "name": "은화",
          "quantity": 5
        }
      }
    }
  ],
  "rawClaims": []
}
[4.1 Commit Result for "은화를 보았다"]: success= false rejectedReasons= [ "[CAUSALITY_VIOLATION] Unbacked inventory ADD of '은화' is rejected." ]
[4.1 Inventory after "은화를 보았다"]: [] stateVersion= 1
[4.2 Parsed Proposal for "은화를 획득했다"]: {
  "proposalId": "prop-req-parse-acq",
  "requestId": "req-parse-acq",
  "eventId": "evt-parse-acq",
  "expectedStateVersion": 1,
  "source": "LLM",
  "turn": 1,
  "timestamp": "2026-08-23T13:58:17.205Z",
  "intentSummary": "사당에서 은화 2닢 획득",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": {
          "id": "item-silver",
          "name": "은화",
          "quantity": 2
        },
        "acquisition": {
          "cause": "DISCOVERY_PICKUP",
          "verifiedEventId": "seed-shrine-silver-2"
        }
      }
    }
  ],
  "rawClaims": []
}
[4.2 Commit Result for "은화를 획득했다"]: success= false rejectedReasons= [
  "[CAUSALITY_VIOLATION] Event 'seed-shrine-silver-2' not found in canonical records."
]
[4.2 Inventory after "은화를 획득했다"]: [] stateVersion= 1

=== SECTION 5: SAVE/HYDRATE TAMPERING (inventory / history / registry / stateVersion / turn) ===
[5.1 Hydrated with tampered inventory]: Snapshot inventory= [{"id":"tampered-dragon-blade","name":"청룡언월도","quantity":1}]
[5.2 Hydrated with wiped registries]: requestRegistry length= 0
[5.2 Replay against wiped registries result]: success= false rejectedReasons= [
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:35.000Z' (1787468435000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.206Z' (1787493497206)."
]
[5.2 Inventory of wiped engine after replay]: []
[5.3 Hydrated with tampered stateVersion 999]: snapshot stateVersion= 999
[5.3 Submit expecting stateVersion=2 against hydrated version=999]: success= false rejectedReasons= [
  '[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 999.',
  "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T07:00:40.000Z' (1787468440000) cannot be earlier than last committed timestamp '2026-08-23T13:58:17.207Z' (1787493497207).",
  '[EMPTY_PROPOSAL_REJECTED] State transition proposal contains no actions.'
]
[5.3 Submit expecting stateVersion=999 against hydrated version=999]: success= false new stateVersion= 999

```

---

## Section 4: behavioralAudit.ts Full RAW Execution Output

```text
====================================================
TRPG 3.1 Sovereign Engine: A~J Behavioral Audit Suite
====================================================

❌ [FAIL] TEST-A: Existing Silver Observation (Unbacked observation ADD rejected, qty remains 5)
❌ [FAIL] TEST-B: Grounded New Silver Acquisition (Exactly +2, stateVersion 2 -> 3)
❌ [FAIL] TEST-C: Re-acquisition of Existing Item (Accurate accumulation 2 + 3 = 5, 1 slot)
❌ [FAIL] TEST-D: Duplicate eventId/requestId Replay Defense (Rejection, change 0)
❌ [FAIL] TEST-E: Same ID / Different Name (ID-based discrimination stacks 1 + 2 = 3)
❌ [FAIL] TEST-F: Different ID / Same Name (Name-based stack 10 + 5 = 15 totalQty)
❌ [FAIL] TEST-G: Non-existent Item REMOVE (Rejection, change 0)
❌ [FAIL] TEST-H: Action Order & Atomicity (5 silver deducted, 1 태극권보 added atomically)
✅ [PASS] TEST-I: Double-Spending Defense (Second acquisition using same event rejected, 2nd book blocked)
❌ [FAIL] TEST-J: SAVE -> HYDRATE Replay Defense (IDEMPOTENCY_VIOLATION, danQty remains 1)

====================================================
Summary: 1/10 Behavioral Audit Tests Passed.
====================================================

[DETAILED_JSON_AUDIT_LOG]
[
  {
    "testId": "TEST-A",
    "testName": "Existing Silver Coin Observation -> Inventory change 0",
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
      "proposalId": "prop-obs-a",
      "requestId": "req-obs-a",
      "eventId": "evt-obs-a",
      "expectedStateVersion": 2,
      "source": "LLM",
      "turn": 1,
      "timestamp": "2026-08-23T06:30:05.000Z",
      "intentSummary": "Observing owned silver coins",
      "actions": [
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "ADD",
            "item": {
              "id": "item-silver",
              "name": "은화",
              "quantity": 5
            }
          }
        }
      ]
    },
    "validatorResult": {
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.038Z' (1787493498038)."
      ]
    },
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.038Z' (1787493498038)."
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
    "actualSummary": "success=false, stateVersion=1 (before=1), silverQty=undefined"
  },
  {
    "testId": "TEST-B",
    "testName": "Grounded New Silver Acquisition -> Exactly +2",
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
      "proposalId": "prop-acq-b",
      "requestId": "req-acq-b",
      "eventId": "evt-acq-b",
      "expectedStateVersion": 2,
      "source": "LLM",
      "turn": 1,
      "timestamp": "2026-08-23T06:30:05.000Z",
      "intentSummary": "Pickup 2 silver coins from chest",
      "actions": [
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "ADD",
            "item": {
              "id": "item-silver",
              "name": "은화",
              "quantity": 2
            },
            "acquisition": {
              "cause": "DISCOVERY_PICKUP",
              "verifiedEventId": "seed-chest-b"
            }
          }
        }
      ]
    },
    "validatorResult": {
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.042Z' (1787493498042)."
      ]
    },
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.042Z' (1787493498042)."
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
    "actualSummary": "success=false, stateVersion=1, silverQty=undefined"
  },
  {
    "testId": "TEST-C",
    "testName": "Re-acquisition of Existing Item -> Accurate Accumulation (2 + 3 = 5)",
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
      "proposalId": "prop-acq-c",
      "requestId": "req-acq-c",
      "eventId": "evt-acq-c",
      "expectedStateVersion": 2,
      "source": "LLM",
      "turn": 1,
      "timestamp": "2026-08-23T06:30:05.000Z",
      "intentSummary": "Claim bounty reward of 3 silver coins",
      "actions": [
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "ADD",
            "item": {
              "id": "item-silver",
              "name": "은화",
              "quantity": 3
            },
            "acquisition": {
              "cause": "GIFT_REWARD",
              "verifiedEventId": "seed-reward-c"
            }
          }
        }
      ]
    },
    "validatorResult": {
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.042Z' (1787493498042)."
      ]
    },
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.042Z' (1787493498042)."
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
    "actualSummary": "success=false, invSlots=0, silverQty=undefined, stateVersion=1"
  },
  {
    "testId": "TEST-D",
    "testName": "Duplicate eventId / requestId Replay Defense -> Change 0",
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
      "proposalId": "prop-orig-d",
      "requestId": "req-orig-d",
      "eventId": "evt-orig-d",
      "expectedStateVersion": 3,
      "source": "LLM",
      "turn": 1,
      "timestamp": "2026-08-23T06:30:10.000Z",
      "intentSummary": "Replay of previous proposal",
      "actions": [
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "ADD",
            "item": {
              "id": "item-silver",
              "name": "은화",
              "quantity": 10
            },
            "acquisition": {
              "cause": "GIFT_REWARD",
              "verifiedEventId": "seed-d"
            }
          }
        }
      ]
    },
    "validatorResult": {
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 3, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:10.000Z' (1787466610000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.043Z' (1787493498043)."
      ]
    },
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 3, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:10.000Z' (1787466610000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.043Z' (1787493498043)."
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
    "actualSummary": "success=false, stateVersion=1 (before=1), silverQty=undefined"
  },
  {
    "testId": "TEST-E",
    "testName": "Same ID / Different Name -> ID-based Discrimination",
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
      "proposalId": "prop-add-e",
      "requestId": "req-add-e",
      "eventId": "evt-add-e",
      "expectedStateVersion": 2,
      "source": "LLM",
      "turn": 1,
      "timestamp": "2026-08-23T06:30:05.000Z",
      "intentSummary": "Add item with matching ID",
      "actions": [
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "ADD",
            "item": {
              "id": "item-001",
              "name": "녹슨 철검",
              "quantity": 2
            },
            "acquisition": {
              "cause": "DISCOVERY_PICKUP",
              "verifiedEventId": "seed-e"
            }
          }
        }
      ]
    },
    "validatorResult": {
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.043Z' (1787493498043)."
      ]
    },
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.043Z' (1787493498043)."
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
    "actualSummary": "success=false, invSlots=0, slotId=undefined, slotQty=undefined"
  },
  {
    "testId": "TEST-F",
    "testName": "Different ID / Same Name -> Target Discrimination Verification",
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
      "proposalId": "prop-add-f",
      "requestId": "req-add-f",
      "eventId": "evt-add-f",
      "expectedStateVersion": 2,
      "source": "LLM",
      "turn": 1,
      "timestamp": "2026-08-23T06:30:05.000Z",
      "intentSummary": "Add same named currency with different ID",
      "actions": [
        {
          "type": "MODIFY_INVENTORY",
          "payload": {
            "operation": "ADD",
            "item": {
              "id": "item-market-coin",
              "name": "전폐",
              "quantity": 5
            },
            "acquisition": {
              "cause": "DISCOVERY_PICKUP",
              "verifiedEventId": "seed-f"
            }
          }
        }
      ]
    },
    "validatorResult": {
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.043Z' (1787493498043)."
      ]
    },
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 2, but current sovereign state is at version 1.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-23T06:30:05.000Z' (1787466605000) cannot be earlier than last committed timestamp '2026-08-23T13:58:18.043Z' (1787493498043)."
      ],
      "committedActionsCount": 0
    },
    "after": {
      "turn": 1,
      "stateVersion": 1,
      "inventory": [],
      "historyCount": 0,
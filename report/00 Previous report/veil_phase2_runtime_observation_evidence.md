# TRPG 3.1 — VEIL Phase 2 Runtime Observational Evidence

- **Execution Timestamp**: 2026-08-25T19:32:24.787Z
- **Git HEAD Commit**: `5379968e761c66cdb4c811bc54d94a8618819b50`
- **Execution Target**: Runtime End-to-End Pipeline (Candidate -> PreAuth -> Recombination -> SafeProposal -> MutationBoundary -> EngineValidator -> Draft -> Commit)

---

## Observational Data Points

### Observation Point 1: PRE_AUTH_ALLOWED_CANDIDATES
- **Timestamp**: `2026-08-25T19:32:24.793Z`
- **Raw Object Dump**:
```json
{
  "totalCandidates": 3,
  "allowedCount": 1,
  "allowedCandidates": [
    {
      "candidateId": 3,
      "label": "이객주와의 환담",
      "preAuthStatus": "ALLOW",
      "rawMetadataIdentifiers": {
        "factCheckSummary": "1) [NPC]: 이객주와의 대화로 호감도 소폭 상승\n2) [소문]: 산적 출몰 소문 청취"
      },
      "proposalActionTypes": [
        "ADD_NPC",
        "RECORD_OFFSCREEN_EVENT"
      ]
    }
  ],
  "rejectedCandidates": [
    {
      "candidateId": 1,
      "label": "약초 상인과의 은화 거래",
      "rejectedReasons": [
        "[INVENTORY_VIOLATION] Item '은화' does not exist in character inventory."
      ]
    },
    {
      "candidateId": 2,
      "label": "출처 불명의 전설검 기습 획득",
      "rejectedReasons": [
        "[CAUSALITY_VIOLATION] Unbacked inventory ADD of '무형검' is rejected."
      ]
    }
  ]
}
```

---

### Observation Point 2: LLM2_SELECTED_CANDIDATE_ID
- **Timestamp**: `2026-08-25T19:32:24.793Z`
- **Raw Object Dump**:
```json
{
  "selectedCandidateId": 1,
  "selectionSource": "LLM#2 Synthesizer Output: {\"selectedCandidateId\": 1}"
}
```

---

### Observation Point 3: SERVER_RECOMBINED_CANDIDATE
- **Timestamp**: `2026-08-25T19:32:24.793Z`
- **Raw Object Dump**:
```json
{
  "selectedCandidateId": 3,
  "recombinedCandidateId": 3,
  "isIdentityEqual": true,
  "recombinedRawMetadata": {
    "factCheckSummary": "1) [NPC]: 이객주와의 대화로 호감도 소폭 상승\n2) [소문]: 산적 출몰 소문 청취",
    "newNpcs": [
      {
        "name": "이객주",
        "alias": "객잔 주인",
        "npcClass": "일반인",
        "innerThought": "새로운 손님이 찾아왔군.",
        "metInStory": true,
        "isDead": false,
        "origin": "산동",
        "background": "객잔 20년 운영",
        "informationAccess": "PUBLIC"
      }
    ],
    "cameraOffscreenEvents": [
      "최근 북쪽 산도에 산적 떼가 출몰하고 있다는 소문이 돌고 있다."
    ]
  },
  "originalPreAuthRawMetadata": {
    "factCheckSummary": "1) [NPC]: 이객주와의 대화로 호감도 소폭 상승\n2) [소문]: 산적 출몰 소문 청취",
    "newNpcs": [
      {
        "name": "이객주",
        "alias": "객잔 주인",
        "npcClass": "일반인",
        "innerThought": "새로운 손님이 찾아왔군.",
        "metInStory": true,
        "isDead": false,
        "origin": "산동",
        "background": "객잔 20년 운영",
        "informationAccess": "PUBLIC"
      }
    ],
    "cameraOffscreenEvents": [
      "최근 북쪽 산도에 산적 떼가 출몰하고 있다는 소문이 돌고 있다."
    ]
  },
  "metadataStrictMatch": true
}
```

---

### Observation Point 4: BUILD_SAFE_PROPOSAL_RESULT
- **Timestamp**: `2026-08-25T19:32:24.793Z`
- **Raw Object Dump**:
```json
{
  "proposalRequestId": "req-mt92ajq1-nkhmij",
  "proposalTurn": 2,
  "actionCount": 2,
  "actions": [
    {
      "type": "ADD_NPC",
      "payload": {
        "id": "npc-mt92ajq1-bymfom",
        "name": "이객주",
        "alias": "객잔 주인",
        "npcClass": "일반인",
        "innerThought": "새로운 손님이 찾아왔군.",
        "metInStory": true,
        "status": "ALIVE",
        "origin": "산동",
        "background": "객잔 20년 운영",
        "martialArts": "",
        "values": "",
        "affiliation": ""
      }
    },
    {
      "type": "RECORD_OFFSCREEN_EVENT",
      "payload": {
        "eventDescription": "최근 북쪽 산도에 산적 떼가 출몰하고 있다는 소문이 돌고 있다.",
        "visibility": "FACTION_ONLY"
      }
    }
  ],
  "deltasFromRawCandidate": {
    "builtInventoryActions": []
  }
}
```

---

### Observation Point 5: MUTATION_BOUNDARY_INVOCATION
- **Timestamp**: `2026-08-25T19:32:24.794Z`
- **Raw Object Dump**:
```json
{
  "callLocation": "src/engine/mutationBoundary.ts -> validateLLM2MutationBoundary()",
  "inputApprovedCandidateProposal": {
    "requestId": "req-mt92ajq1-g9vse5",
    "actionsCount": 2,
    "actionsSummary": [
      {
        "type": "ADD_NPC",
        "payload": {
          "id": "npc-mt92ajq1-b8pqjo",
          "name": "이객주",
          "alias": "객잔 주인",
          "npcClass": "일반인",
          "innerThought": "새로운 손님이 찾아왔군.",
          "metInStory": true,
          "status": "ALIVE",
          "origin": "산동",
          "background": "객잔 20년 운영",
          "martialArts": "",
          "values": "",
          "affiliation": ""
        }
      },
      {
        "type": "RECORD_OFFSCREEN_EVENT",
        "payload": {
          "eventDescription": "최근 북쪽 산도에 산적 떼가 출몰하고 있다는 소문이 돌고 있다.",
          "visibility": "FACTION_ONLY"
        }
      }
    ]
  },
  "inputFinalProposal": {
    "requestId": "req-mt92ajq1-nkhmij",
    "actionsCount": 2,
    "actionsSummary": [
      {
        "type": "ADD_NPC",
        "payload": {
          "id": "npc-mt92ajq1-bymfom",
          "name": "이객주",
          "alias": "객잔 주인",
          "npcClass": "일반인",
          "innerThought": "새로운 손님이 찾아왔군.",
          "metInStory": true,
          "status": "ALIVE",
          "origin": "산동",
          "background": "객잔 20년 운영",
          "martialArts": "",
          "values": "",
          "affiliation": ""
        }
      },
      {
        "type": "RECORD_OFFSCREEN_EVENT",
        "payload": {
          "eventDescription": "최근 북쪽 산도에 산적 떼가 출몰하고 있다는 소문이 돌고 있다.",
          "visibility": "FACTION_ONLY"
        }
      }
    ]
  },
  "boundaryResult": {
    "isValid": false,
    "violationReasons": [
      "[MUTATION_BOUNDARY_VIOLATION] Action #1 (ADD_NPC) is not authorized in approved candidate. Details: No matching unused candidate action found."
    ]
  }
}
```

---

### Observation Point 6: PROPOSAL_PRIOR_TO_SUBMIT
- **Timestamp**: `2026-08-25T19:32:24.794Z`
- **Raw Object Dump**:
```json
{
  "engineCurrentStateVersion": 2,
  "engineCurrentTurn": 1,
  "submittingProposal": {
    "requestId": "req-mt92ajq1-nkhmij",
    "turn": 2,
    "timestamp": "2026-08-25T19:32:24.793Z",
    "actions": [
      {
        "type": "ADD_NPC",
        "payload": {
          "id": "npc-mt92ajq1-bymfom",
          "name": "이객주",
          "alias": "객잔 주인",
          "npcClass": "일반인",
          "innerThought": "새로운 손님이 찾아왔군.",
          "metInStory": true,
          "status": "ALIVE",
          "origin": "산동",
          "background": "객잔 20년 운영",
          "martialArts": "",
          "values": "",
          "affiliation": ""
        }
      },
      {
        "type": "RECORD_OFFSCREEN_EVENT",
        "payload": {
          "eventDescription": "최근 북쪽 산도에 산적 떼가 출몰하고 있다는 소문이 돌고 있다.",
          "visibility": "FACTION_ONLY"
        }
      }
    ]
  }
}
```

---

### Observation Point 7: ENGINE_VALIDATOR_EVALUATION
- **Timestamp**: `2026-08-25T19:32:24.794Z`
- **Raw Object Dump**:
```json
{
  "validatorInputs": {
    "proposalTurn": 2,
    "proposalActionsCount": 2,
    "canonicalStateVersion": 2,
    "executedRequestIdsCount": 0,
    "recordedEventIdsCount": 0,
    "historicalRecordsCount": 1
  },
  "validationOutput": {
    "isValid": true,
    "rejectedReasons": [],
    "conflictDetails": []
  }
}
```

---

### Observation Point 8: DRAFT_AND_COMMIT_EXECUTION
- **Timestamp**: `2026-08-25T19:32:24.795Z`
- **Raw Object Dump**:
```json
{
  "commitSuccess": true,
  "committedActionsCount": 2,
  "newStateVersion": 3,
  "newHistoricalRecordsCount": 2,
  "rejectedReasons": [],
  "conflictDetails": [],
  "inventorySnapshotBefore": [
    {
      "id": "inv_silver_coin",
      "name": "은화",
      "quantity": 20,
      "type": "재화",
      "isEquipped": false
    }
  ],
  "inventorySnapshotAfter": [
    {
      "id": "inv_silver_coin",
      "name": "은화",
      "quantity": 20,
      "type": "재화",
      "isEquipped": false
    }
  ],
  "historyTail": [
    {
      "recordId": "rec-evt-mt92ajq1-uac50r-2",
      "eventId": "evt-mt92ajq1-uac50r",
      "requestId": "req-mt92ajq1-nkhmij",
      "proposalId": "prop-req-mt92ajq1-nkhmij",
      "turn": 2,
      "timestamp": "2026-08-25T19:32:24.793Z",
      "narrativeTime": {
        "year": 1,
        "season": "봄",
        "day": 1,
        "timeOfDay": "오전",
        "formattedTime": "1년차 봄 1일 오전"
      },
      "source": "LLM",
      "actionType": "RECORD_OFFSCREEN_EVENT",
      "details": "{\"eventDescription\":\"최근 북쪽 산도에 산적 떼가 출몰하고 있다는 소문이 돌고 있다.\",\"visibility\":\"FACTION_ONLY\"}",
      "stateVersionAfterCommit": 3,
      "informationAccess": "FACTION_ONLY"
    }
  ]
}
```


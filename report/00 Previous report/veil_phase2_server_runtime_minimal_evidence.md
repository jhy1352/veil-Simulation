# TRPG 3.1 — VEIL Phase 2 Server Runtime Minimal Observation

- **Execution Timestamp**: 2026-08-25T19:42:20.101Z
- **Git HEAD Commit**: `c44e4701e69b596d66e7ea81b5d635035fe7cb91`
- **Execution Target**: Server Runtime Specifics (1. Mutation Boundary Block Behavior, 2. Rejected Candidate ID Binding)

---

## 1. Mutation Boundary `false` -> `submitProposal()` Invocation Observation

```json
{
  "approvedCandidateActions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "item": {
          "id": "item-mt92nb2e-l79kgx",
          "name": "은화",
          "quantity": 5
        },
        "operation": "REMOVE"
      }
    },
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "item": {
          "id": "item-mt92nb2e-0s1h9h",
          "name": "지혈초",
          "quantity": 1
        },
        "operation": "ADD",
        "acquisition": {
          "cause": "RESOURCE_EXCHANGE",
          "cost": {
            "name": "은화",
            "quantity": 5
          }
        }
      }
    }
  ],
  "tamperedProposalActions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "item": {
          "id": "item-mt92nb2e-l79kgx",
          "name": "은화",
          "quantity": 5
        },
        "operation": "REMOVE"
      }
    },
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "item": {
          "id": "item-mt92nb2e-0s1h9h",
          "name": "지혈초",
          "quantity": 1
        },
        "operation": "ADD",
        "acquisition": {
          "cause": "RESOURCE_EXCHANGE",
          "cost": {
            "name": "은화",
            "quantity": 5
          }
        }
      }
    },
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": {
          "id": "inv_gold_ingot",
          "name": "황금",
          "quantity": 99,
          "type": "재화",
          "isEquipped": false
        }
      }
    }
  ],
  "mutationBoundaryResult": {
    "isValid": false,
    "violationReasons": [
      "[MUTATION_BOUNDARY_VIOLATION] Final proposal contains 3 actions, exceeding approved candidate action count (2)."
    ]
  },
  "submitProposalInvocation": {
    "submitProposalCalled": false,
    "stateVersionBefore": 2,
    "stateVersionAfter": 2,
    "inventoryBefore": [
      {
        "id": "inv_silver_coin",
        "name": "은화",
        "quantity": 20,
        "type": "재화",
        "isEquipped": false
      }
    ],
    "inventoryAfter": [
      {
        "id": "inv_silver_coin",
        "name": "은화",
        "quantity": 20,
        "type": "재화",
        "isEquipped": false
      }
    ],
    "isStateUnmutated": true
  },
  "directEngineSubmitIfBoundaryBypassed": {
    "description": "Even if boundary was bypassed directly to EngineValidator:",
    "directEngineValidatorResult": {
      "isValid": false,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 1, but current sovereign state is at version 2.",
        "[TIMESTAMP_REGRESSION_CONFLICT] Proposal timestamp '2026-08-25T19:42:20.102Z' (1787686940102) cannot be earlier than last committed timestamp '2026-08-25T19:42:20.106Z' (1787686940106)."
      ],
      "conflictDetails": [],
      "sanitizedActions": []
    }
  }
}
```

---

## 2. REJECTED `selectedCandidateId` -> Server Candidate Binding Observation

```json
{
  "totalCandidates": [
    {
      "id": 1,
      "label": "정상 상인 거래"
    },
    {
      "id": 2,
      "label": "출처 불명 전설검 획득"
    },
    {
      "id": 3,
      "label": "이객주와의 환담"
    }
  ],
  "preAuthSummary": {
    "allowed": [
      {
        "id": 3,
        "label": "이객주와의 환담"
      }
    ],
    "rejected": [
      {
        "id": 1,
        "label": "정상 상인 거래"
      },
      {
        "id": 2,
        "label": "출처 불명 전설검 획득"
      }
    ]
  },
  "llm2ReturnedCandidateId": 2,
  "isLlm2IdInAllowedList": false,
  "isLlm2IdInRejectedList": true,
  "serverBindingCode": "allowedCandidates.find(c => c.candidateId === selectedId) || allowedCandidates[0]",
  "actualBoundCandidate": {
    "boundCandidateId": 3,
    "boundLabel": "이객주와의 환담",
    "boundRawMetadata": {
      "factCheckSummary": "1) 대화",
      "newNpcs": [
        {
          "name": "이객주",
          "alias": "객잔 주인",
          "npcClass": "일반인",
          "innerThought": "새 손님",
          "metInStory": true,
          "isDead": false,
          "origin": "산동",
          "background": "객잔 20년",
          "informationAccess": "PUBLIC"
        }
      ]
    }
  },
  "serverBehaviorSummary": "When LLM#2 selects a REJECTED Candidate ID (ID 2), allowedCandidates.find() returns undefined, and the server falls back to allowedCandidates[0] (Candidate 1, ALLOW). The REJECTED candidate metadata is NOT used."
}
```

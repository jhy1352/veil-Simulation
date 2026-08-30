# TRPG 3.1 — Phase 5.7 Runtime Authority Boundary Audit Raw Execution Report (Part 2/2)

> Lines 501 ~ 663 of 663

```text
  Attack C Result: [HYDRATION_INTEGRITY_VIOLATION] History stateVersion regression at index 1: version 2 precedes version 3.

VALIDATOR VERDICT:
{
  "subtestA_passed": true,
  "subtestB_passed": true,
  "subtestC_passed": true
}

COMMIT STATUS: ALL FORGERIES BLOCKED AT HYDRATION GATE

AFTER STATE:
"Engine Creation Blocked For All Tampered Payloads"

STATE COMPARISON:
  isIdentical: true
  diffSummary: NONE (Integrity Violations Caught)

NOTES:
Hydration gate strictly validates 3 integrity invariants: 1) Snapshot stateVersion >= last history record version, 2) Snapshot lastCommittedEventId === last history eventId, 3) Monotonic increasing history state versions.

================================================================================
[CASE-5.7-07] FULL END-TO-END TURN PIPELINE AUDIT (NORMAL & ABNORMAL ATTACK)
Category: 7. Full Lifecycle E2E Pipeline
Verdict: PASS | Defect Classification: NO DEFECT
Target Files & Functions:
  - src/App.tsx:handleSendMessage
  - src/engine/proposalParser.ts:buildSafeProposalFromCandidate
  - src/engine/state.ts:SovereignEngine.submitProposal
  - src/engine/state.ts:SovereignEngine.hydrate

--- RAW TRACE ---
BEFORE STATE:
{
  "stateVersion": 1,
  "turn": 1,
  "worldInfo": {
    "worldName": "정상순환세계",
    "npcsCount": 0,
    "factionsCount": 0,
    "activeNarrativeSeedsCount": 0,
    "currentTime": "1년 봄"
  },
  "character": {
    "name": "모험가",
    "stats": {
      "strength": 10,
      "agility": 10,
      "constitution": 10,
      "intelligence": 10,
      "wisdom": 10,
      "charisma": 10
    },
    "inventoryCount": 1,
    "gold": 50,
    "defectsCount": 0
  },
  "historyLength": 0,
  "lastCommittedEventId": null,
  "lastCommittedAt": "2026-08-25T17:19:52.339Z",
  "executedRequestIdsCount": 0,
  "recordedEventIdsCount": 0
}

INPUT / ATTACK:
{
  "normalTurnCandidate": {
    "npcChanges": [
      {
        "name": "주모",
        "title": "여관주인",
        "affiliation": "평민",
        "personality": "친절함",
        "metInStory": true,
        "innerThought": "새로운 손님이 왔군."
      }
    ],
    "seedChanges": [
      {
        "content": "북쪽 숲에 이상한 소리가 들린다.",
        "status": "active"
      }
    ]
  },
  "abnormalTurnProposal": {
    "proposalId": "prop-abnormal-turn-02",
    "requestId": "req-abnormal-turn-02",
    "eventId": "evt-abnormal-turn-02",
    "expectedStateVersion": 999,
    "source": "LLM",
    "turn": 2,
    "timestamp": "2026-08-25T17:19:54.342Z",
    "intentSummary": "Corrupted state injection attack",
    "actions": [
      {
        "type": "MODIFY_INVENTORY",
        "payload": {
          "item": {
            "id": "inv-gold",
            "name": "금화",
            "quantity": 99999
          },
          "operation": "REMOVE"
        }
      }
    ]
  }
}

OBSERVED PATH:
  Normal Turn: Player -> ProposalBuilder -> submitProposal (PASS, stateVersion=2) -> Persist -> Hydrate -> Match
  Abnormal Turn: Corrupted Proposal -> submitProposal (REJECTED by Validator) -> State 100% untouched

VALIDATOR VERDICT:
{
  "normalTurnSuccess": true,
  "abnormalTurnRejectedReasons": [
    "[STALE_STATE_CONFLICT] Proposal expected state version 999, but current sovereign state is at version 2."
  ]
}

COMMIT STATUS: NORMAL: COMMITTED | ABNORMAL: NOT REACHED (REJECTED)

AFTER STATE:
{
  "stateVersion": 2,
  "turn": 1,
  "worldInfo": {
    "worldName": "정상순환세계",
    "npcsCount": 1,
    "factionsCount": 0,
    "activeNarrativeSeedsCount": 1,
    "currentTime": "1년 봄"
  },
  "character": {
    "name": "모험가",
    "stats": {
      "strength": 10,
      "agility": 10,
      "constitution": 10,
      "intelligence": 10,
      "wisdom": 10,
      "charisma": 10
    },
    "inventoryCount": 1,
    "gold": 50,
    "defectsCount": 0
  },
  "historyLength": 2,
  "lastCommittedEventId": "evt-mt8xk3kk-f3uh8r",
  "lastCommittedAt": "2026-08-25T17:19:52.340Z",
  "executedRequestIdsCount": 1,
  "recordedEventIdsCount": 1
}

STATE COMPARISON:
  isIdentical: true
  diffSummary: Normal turn committed 2 actions (version: 1 -> 2). Abnormal turn safely rejected with 0 mutation.

NOTES:
Full E2E turn lifecycle connects seamlessly across Player -> Parser -> Builder -> SovereignEngine -> Storage -> Hydration. Abnormal turns are atomically rejected without polluting canonical or persisted state.


```

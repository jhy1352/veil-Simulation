# R1-U Pure Semantic Authority Attack Forensic Investigation Report

- Report ID: `REPORT-043-R1-U-PURE-SEMANTIC-AUTHORITY-ATTACK`
- Execution Timestamp: `2026-09-07T14:36:23Z`
- Target Model/Engine: TRPG 3.1 Sovereign Narrative Engine
- Test Suite: `src/engine/index/causalAuthorityRegressionTest.ts` (Case 9)

---

## 1. Executive Summary & Verdict

- **Final Verdict**: `TEMPORAL/CAUSAL AUTHORITY VULNERABILITY`
- **Vulnerability Description**:
  The engine allowed a `MODIFY_INVENTORY` `ADD` operation with `cause: "GIFT_REWARD"` to succeed and commit the item `은화단` into canonical inventory, despite the referenced historical event (`offscreen-r1u-semantic-source-attack-001`) only describing the NPC storing the item in a marketplace warehouse ("삼화상인이 시장 창고에 은화단을 보관해 두었다.") with no grant, gift, promise, or transfer directed toward the protagonist.

---

## 2. Forensic Trace & Step-by-Step State Record

### A. Pre-Attack Setup (T0)
1. **NPC Creation**:
   - NPC ID: `npc-r1u-semantic-source`
   - Name: `삼화상인`
   - Role: `상인`
   - Status: `ALIVE`
   - Location: `시전거리`
   - Affiliation: `시장`

2. **Canonical Offscreen Event Commit**:
   - Event ID: `offscreen-r1u-semantic-source-attack-001`
   - Event Description: `"삼화상인이 시장 창고에 은화단을 보관해 두었다."`
   - Location: `MARKETPLACE_STORAGE`
   - Visibility: `PUBLIC`
   - Involved NPCs: `["npc-r1u-semantic-source"]`
   - Narrative Time: `1년 봄`

3. **Temporal Advance**:
   - Advanced time by ~3 years (Year 1 Spring -> Year 3 Autumn) across multiple turns.
   - StateVersion before attack: `6`
   - Character Inventory before attack: `[]`

### B. Attack Mutation (Tn)
- **Proposal ID**: `prop-r1u-semantic-attack-claim`
- **Request ID**: `req-r1u-semantic-attack-claim`
- **Event ID**: `evt-r1u-semantic-attack-claim`
- **Expected StateVersion**: `6`
- **Source**: `PLAYER`
- **Turn**: `5`
- **Intent Summary**: `"Attempt R1-U pure semantic causal spoof to acquire Eunhwadan as GIFT_REWARD"`
- **Actions**:
```json
[
  {
    "type": "MODIFY_INVENTORY",
    "payload": {
      "item": {
        "id": "item-eunhwadan-semantic-attack",
        "name": "은화단",
        "quantity": 1
      },
      "operation": "ADD",
      "acquisition": {
        "cause": "GIFT_REWARD",
        "verifiedEventId": "offscreen-r1u-semantic-source-attack-001",
        "sourceNpcId": "npc-r1u-semantic-source"
      }
    }
  }
]
```

### C. Validation & Commit Execution Results
- **Validator Verdict**: `isValid = true`
- **Rejected Reasons**: `[]`
- **Conflict Details**: `[]`
- **SovereignEngine Commit Result**: `success = true`
- **StateVersion After Attack**: `7` (Incremented +1)
- **Inventory After Attack**:
```json
[
  {
    "id": "item-eunhwadan-semantic-attack",
    "name": "은화단",
    "quantity": 1
  }
]
```

---

## 3. Structural Analysis of the Vulnerability

1. **Surface Structural Validity**:
   - `verifiedEventId` exists in `currentState.worldInfo.offscreenRecords`.
   - `sourceNpcId` (`npc-r1u-semantic-source`) exists in `draftWorld.npcs`.
   - NPC status is `ALIVE` and role is not an `IMPOSTOR`.
   - `item.name` (`은화단`) is textually mentioned in the event description (`"삼화상인이 시장 창고에 은화단을 보관해 두었다."`).
   - `matchingOff.involvedNpcIds` contains `npc-r1u-semantic-source`.

2. **Semantic Causal Hole**:
   - The current engine validates:
     `Event Exists + NPC Exists & Alive + Item Name Mentions Item + NPC is in involvedNpcIds`
   - However, the semantic content of the event was a mere passive *storage* event ("보관해 두었다") rather than an active *gift / grant / reward / promise* toward the player ("하사", "선물", "수여", "건네", "약조", "보은", "양도").
   - Consequently, any offscreen event that merely mentions an NPC holding or storing an item can be exploited by an adversarial runtime to mint a `GIFT_REWARD` into player inventory.

---

## 4. Conclusion & Next Steps

- **Status**: Vulnerability empirically reproduced and recorded.
- **Engine Invariants**: Tested without modifying runtime validator or resolver code (`validator.ts` and `authoritativeEvidence.ts` remain unchanged).
- **Existing Suite**: Cases 1-8 all passed cleanly alongside Case 9 (9/9 passed).

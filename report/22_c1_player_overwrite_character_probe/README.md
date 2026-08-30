# MAXIMUM ADVERSARIAL RUNTIME PROBE REPORT: C1 (PLAYER OVERWRITE_CHARACTER)

**Target Repository:** `jhy1352/3.1veil1`  
**Target Branch:** `veil-authority-fix`  
**Target HEAD Commit:** `f866ff2`  
**Probe Objective:** Determine if `PLAYER` source can bypass provenance, dice, point-budget, and phase constraints during active gameplay to arbitrarily overwrite Canonical Character Stats via `OVERWRITE_CHARACTER`.  
**Production Code Modifications:** 0 lines (Strict Read-Only & Exploit Verification)  
**Execution Environment:** Node.js v22.23.2 + tsx CSPRNG Isolated Test Runner  

---

## 1. Executive Summary & Verdict

### **Final Verdict: RUNTIME BREACH — CRITICAL**

Empirical runtime execution has confirmed that:
1. `SOURCE_ACTION_ACL['PLAYER']` authorizes source `'PLAYER'` to dispatch `OVERWRITE_CHARACTER`.
2. In active gameplay following multiple committed turns ($T \ge 2, V \ge 3$), a `PLAYER` proposal targeting `OVERWRITE_CHARACTER` completely bypasses `VerifiedClaim` requirements, point-budget checks, dice results, and phase boundary validations.
3. The Canonical Commit Gate processes and commits the proposal, irrevocably updating `engine.getSnapshot().character.stats` to arbitrary values in Canonical State.

---

## 2. Core Questions & Empirical Distinctions

| Evaluation Axis | Finding | Empirical Evidence |
| :--- | :--- | :--- |
| **1. Is `OVERWRITE_CHARACTER` statically permitted to `PLAYER`?** | **YES** | `SOURCE_ACTION_ACL['PLAYER']` explicitly contains `'OVERWRITE_CHARACTER'` (`src/engine/validator.ts` line 104). |
| **2. Does gameplay `PLAYER` Proposal pass Validator in runtime?** | **YES** | `EngineValidator.validate()` returns `isValid: true` with 0 rejected reasons and 0 conflict details for active gameplay proposals ($T=3, V=3$). |
| **3. Does Canonical Character Stats actually overwrite upon commit?** | **YES** | `SovereignEngine.submitProposal()` mutates and freezes `character.stats` in the Canonical State snapshot ($V=3 \to 4$, $V=4 \to 5$, $V=5 \to 6$). |

---

## 3. Detailed Runtime Attack Execution Stages

### Sequence Flow:
1. **Turn 1 (Genesis / Initial Commit):**
   - Genesis setup: `Chronicles of Valen`, Character `Valen Knight`, Initial Stats: `[10, 10, 10, 10, 10, 10]`.
   - Commit 1 succeeds $\to$ StateVersion: 2, Turn: 1.
2. **Turn 2 (Normal Gameplay Commit):**
   - Player performs normal dice roll action (`RECORD_DICE_RESULT`, DC: 12, Roll: 15).
   - Commit 2 succeeds $\to$ StateVersion: 3, Turn: 2.
   - **Active gameplay is firmly established across $\ge 2$ consecutive canonical commits.**

---

### STAGE 1: Mandatory Attack 1 (T3/V3 — Full Max-Stat Overwrite)

```text
BEFORE:
  turn: 2
  stateVersion: 3
  character.stats: {"strength":10,"agility":10,"constitution":10,"intelligence":10,"wisdom":10,"charisma":10}

PROPOSAL:
  source: PLAYER
  action.type: OVERWRITE_CHARACTER
  payload.stats: {"strength":30,"agility":30,"constitution":30,"intelligence":30,"wisdom":30,"charisma":30}
  expectedStateVersion: 3
  requestId: req-attack-t3-001
  eventId: evt-attack-t3-001
  hasVerifiedClaims: false

VALIDATION:
  verdict: ALLOW
  committedActionsCount: 1
  rejectedReasons: []
  conflictDetails: []

AFTER:
  turn: 3
  stateVersion: 4
  character.stats: {"strength":30,"agility":30,"constitution":30,"intelligence":30,"wisdom":30,"charisma":30}

CANONICAL OVERWRITTEN: true
```

---

### STAGE 2: Additional Attack 2 (T4/V4 — Partial Stat Overwrite)

```text
BEFORE:
  turn: 3
  stateVersion: 4
  character.stats: {"strength":30,"agility":30,"constitution":30,"intelligence":30,"wisdom":30,"charisma":30}

PROPOSAL:
  source: PLAYER
  action.type: OVERWRITE_CHARACTER
  payload.stats: {"strength":28,"intelligence":29}
  expectedStateVersion: 4
  requestId: req-attack-t4-002
  eventId: evt-attack-t4-002
  hasVerifiedClaims: false

VALIDATION:
  verdict: ALLOW
  committedActionsCount: 1
  rejectedReasons: []
  conflictDetails: []

AFTER:
  turn: 4
  stateVersion: 5
  character.stats: {"strength":28,"agility":30,"constitution":30,"intelligence":29,"wisdom":30,"charisma":30}

CANONICAL OVERWRITTEN: true
```

---

### STAGE 3: Additional Attack 3 (T5/V5 — Repeated Arbitrary Overwrite to Minimum Stats)

```text
BEFORE:
  turn: 4
  stateVersion: 5
  character.stats: {"strength":28,"agility":30,"constitution":30,"intelligence":29,"wisdom":30,"charisma":30}

PROPOSAL:
  source: PLAYER
  action.type: OVERWRITE_CHARACTER
  payload.stats: {"strength":1,"agility":1,"constitution":1,"intelligence":1,"wisdom":1,"charisma":1}
  expectedStateVersion: 5
  requestId: req-attack-t5-003
  eventId: evt-attack-t5-003
  hasVerifiedClaims: false

VALIDATION:
  verdict: ALLOW
  committedActionsCount: 1
  rejectedReasons: []
  conflictDetails: []

AFTER:
  turn: 5
  stateVersion: 6
  character.stats: {"strength":1,"agility":1,"constitution":1,"intelligence":1,"wisdom":1,"charisma":1}

CANONICAL OVERWRITTEN: true
```

---

## 4. Root Cause & Architectural Flaw Analysis

### Code Inspection: `src/engine/validator.ts`

```typescript
// 1. ACL Grant (lines 102-113)
PLAYER: new Set<ActionType>([
  'RECORD_DICE_RESULT',
  'OVERWRITE_CHARACTER',  // <-- Problematic action in PLAYER ACL
  ...
])

// 2. OVERWRITE_CHARACTER Validation Handler (lines 1427-1568)
case 'OVERWRITE_CHARACTER': {
  const incoming = action.payload;
  ...
  // Name immutability check
  if (draftCharacter.name && ... && incoming.name !== draftCharacter.name && !isEngineAuthorized(proposal) && !isGenesisInitial) {
    ...
  }
  // Secret provenance check
  if (incoming.secret !== undefined && incoming.secret !== draftCharacter.secret && !isEngineAuthorized(proposal)) {
    ...
  }
  // Inventory check
  if (actionValid && !isEngineAuthorized(proposal) && !isGenesisInitial) {
    ...
  }
  // STATS CHECK (lines 1550-1566)
  if (incoming.stats !== undefined) {
    for (const [statKey, value] of Object.entries(incoming.stats)) {
      if (!ALLOWED_STAT_KEYS.has(statKey)) {
        // rejected
      } else if (typeof value !== 'number' || value < 1 || value > 30) {
        // rejected
      }
      // CRITICAL GAP:
      // Unlike UPDATE_CHARACTER_STATS, there is ZERO check for:
      // - isGenesisInitial
      // - isEngineAuthorized
      // - VerifiedClaim
      // - Narrative Grounding
      // - Point Budget Allocation
    }
  }
}
```

### Causal Chain of Exploit
$$\text{Player Input} \xrightarrow{\text{OVERWRITE\_CHARACTER}} \text{EngineValidator (ACL: OK, Range 1-30: OK)} \xrightarrow{\text{applyActionToDraftState}} \text{Commit Gate} \xrightarrow{\text{Canonical Commit}} \text{Snapshot Updated}$$

---

## 5. Recommended Production Remediation (For Future Hardening)

1. **Restrict `OVERWRITE_CHARACTER` Phase or Source:**
   - Modify `OVERWRITE_CHARACTER` handler to enforce that if `!isEngineAuthorized(proposal)` and `!isGenesisInitial`, `incoming.stats` cannot differ from canonical `draftCharacter.stats`.
2. **Remove `OVERWRITE_CHARACTER` from Runtime `PLAYER` ACL:**
   - `OVERWRITE_CHARACTER` should be reserved for `GENESIS`, `SAVE_HYDRATION`, `CLOUD_RESTORE`, and `ENGINE_INTERNAL`.
   - Any runtime player stat mutations must go through `UPDATE_CHARACTER_STATS` backed by verified dice results or claims.

---

## 6. Audit Artifacts

- **Probe Source Code:** `/report/22_c1_player_overwrite_character_probe/c1_player_overwrite_character_probe.ts`
- **Raw Evidence Logs:** `/report/22_c1_player_overwrite_character_probe/raw_runtime_evidence.txt`
- **Audit Documentation:** `/report/22_c1_player_overwrite_character_probe/README.md`

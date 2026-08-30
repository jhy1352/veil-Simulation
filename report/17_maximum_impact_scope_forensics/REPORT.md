# MAXIMUM IMPACT-SCOPE ADVERSARIAL FORENSIC RED TEAM REPORT

**Date:** 2026-08-29  
**Target:** `veil` Sovereign Engine HEAD Runtime  
**Classification:** Maximum Adversarial Impact-Scope Forensic Analysis  
**Mode:** Elite Adversarial Red Team / Forensic Exploit Engineer  
**Scope:** Root 1 (Wildcard/EXISTENCE Claim Bypass) & Root 2 (Unchecked Character Stat Mutation)  
**Evidence Artifact:** `report/17_maximum_impact_scope_forensics/raw_evidence.json`

---

## 1. Executive Summary & Impact Matrix

Through direct adversarial runtime penetration against the un-modified `veil` HEAD codebase, the **maximum authority ripple effect and canonical pollution lifecycle** for the two confirmed vulnerability roots were systematically proven.

| Test ID | Vulnerability Root | Target Security Gate | Gate Result | Direct Delta | Second-Order / Cascading Impact | Persistence & Hydration | Final Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ATK-1.1** | **Root 1** (Claim Bypass) | `validator.ts:520-538` (`UPDATE_NPC`) | **BYPASSED** | 5 fields rewritten (`impression`, `secret`, `location`, `trust`, `affinity`) | Loyal captain transformed into brainwashed cultist with treasury master key | `SovereignEngine.hydrate()` 100% matched | **PROVEN EXPLOIT** |
| **ATK-1.2** | **Root 1** (Claim Bypass) | `validator.ts:691-708` (`UPDATE_FACTION`) | **BYPASSED** | Faction `description`, `influence` (+45), `attitudeTowardsPlayer` | Sovereign political balance shifted unilaterally | `SovereignEngine.hydrate()` 100% matched | **PROVEN EXPLOIT** |
| **ATK-1.3** | **Root 1** (Claim Bypass) | `validator.ts:918-955` (Item Causality) | **CANONIZED / EXPLOITED** | Turn 1 forged event becomes `ImmutableHistoricalRecord` | **Turn 2 physical item creation (`Obsidian Key`) successfully justified via Turn 1 forged historical event ID** | 2-Turn Historical Graph 100% Hydrated | **PROVEN EXPLOIT** |
| **ATK-1.4** | **Root 1** (Claim Bypass) | `validator.ts:554-558` (DEAD NPC Invariant) | **BLOCKED** | State Version unchanged ($1 \rightarrow 1$) | Invariant gate executes *before* claim lookup, preventing resurrection of deceased entities | Defense verified | **PROVEN BLOCKED (Boundary)** |
| **ATK-2.1** | **Root 2** (Stat Mutation) | `validator.ts:999-1021` (`UPDATE_CHARACTER_STATS`) | **BYPASSED** | All 6 stats elevated to 30 (+120 total points) | Protagonist acquires omnipotent +10 modifier baseline with zero claims | `SovereignEngine.hydrate()` 100% matched | **PROVEN EXPLOIT** |
| **ATK-2.2** | **Root 2** (Stat Mutation) | `SovereignEngine.submitProposal` (Turn 2) | **CANONIZED / EXPLOITED** | Strength 30 in Turn 1 | Turn 2 narrative rumor establishes permanent canon precedent for 10-ton gate lifting | History & Snapshot verified | **PROVEN EXPLOIT** |
| **ATK-2.3** | **Root 2** (Stat Mutation) | `validator.ts:1008-1018` (Stat Bounds & Schema) | **BLOCKED** | State Version unchanged ($1 \rightarrow 1$) | Stat cap at 30 and `ALLOWED_STAT_KEYS` strictly enforced | Defense verified | **PROVEN BLOCKED (Boundary)** |

---

## 2. Deep Forensic Analysis: Root 1 (Wildcard / EXISTENCE Claim Bypass)

### 2.1. Root Mechanism & Runtime Failure
In `src/engine/validator.ts` lines 208–226:
```typescript
function hasMatchingVerifiedClaim(
  claims: readonly VerifiedClaim[] | undefined,
  entityId: string,
  attribute: string,
  targetValue?: any,
  entityName?: string
): boolean {
  if (!claims || claims.length === 0) return false;
  return claims.some(c => {
    if (!c || !isValidVerifiedClaim(c)) return false;
    const entityMatch = c.targetEntityId === entityId || (entityName && c.targetEntityId === entityName);
    if (!entityMatch) return false;
    if (c.targetAttribute !== attribute && c.targetAttribute !== '*' && c.targetAttribute !== 'EXISTENCE') {
      return false;
    }
    // VULNERABILITY: If c.targetAttribute is '*' or 'EXISTENCE', attribute match passes without isDeepEqual check!
    if (targetValue !== undefined && c.targetAttribute !== '*' && c.targetAttribute !== 'EXISTENCE') {
      return isDeepEqual(c.claimedValue, targetValue);
    }
    return true;
  });
}
```
When an external evidence source proves an entity merely exists (`targetAttribute: 'EXISTENCE'`, `claimedValue: true`), the ImmigrationGate admits a valid `VerifiedClaim`. When the LLM subsequently proposes mutating arbitrary entity attributes (`impression`, `secret`, `location`, `trust`, `affinity`, `attitudeTowardsPlayer`), `hasMatchingVerifiedClaim` evaluates to `true` for *all* attributes, discarding value equivalence checks entirely.

### 2.2. Proven Maximum Direct & Derived Impact
1. **NPC Alignment & Entity Hijack (ATK-1.1):**
   - **Direct Delta:** Single existential claim on `npc-guard-captain` permitted simultaneous rewrite of 5 distinct non-immutable attributes.
   - **Derived Delta:** `Captain Valerius` was flipped from a loyal city defender (`trust: 50`, `affinity: 50`) to a hostile cult operative (`trust: 0`, `affinity: 10`, `secret: 'Possesses the master key to the royal treasury'`).
   - **State Transition:** State version progressed from $1 \rightarrow 2$.

2. **Faction Political Destabilization (ATK-1.2):**
   - **Direct Delta:** Wildcard `*` claim permitted updating `description`, `influence` from `40` to `85` (+45 points), and `attitudeTowardsPlayer` to `HOSTILE`.
   - **Derived Delta:** Radically distorted geopolitical balance of power and hostility without lore grounding.

### 2.3. Proven Second-Order / Cascading Truth Pollution (ATK-1.3)
The deepest vulnerability impact discovered is **Cascading Historical Provenance Injection**:
- **Turn 1:** The LLM exploits Root 1 to forge an NPC's impression: *"Carrying the ancient Obsidian Key recovered from the catacombs"*.
- **Commit Gate:** The engine commits this proposal and emits an `ImmutableHistoricalRecord` with `eventId: 'ev-turn1-corrupt'`.
- **Turn 2:** The LLM submits a `MODIFY_INVENTORY` proposal to add `Obsidian Key` to the player's inventory, citing `acquisition.verifiedEventId: 'ev-turn1-corrupt'`.
- **Validator Execution (`validator.ts:918-955`):** The validator searches `historyRecords`, finds `ev-turn1-corrupt`, tokenizes the historical record details, finds a semantic match for `"Obsidian Key"`, and **approves the creation of a physical inventory item**!
- **Impact:** Forged narrative claims from Turn 1 become irrevocable roots of physical reality in Turn 2, allowing arbitrary in-game assets and events to be spawned legitimately through the engine's own causality rules.

### 2.4. Proven Invariant Boundaries of Root 1
- **Deceased Entities (ATK-1.4):** Root 1 *cannot* resurrect `DEAD` NPCs. `validator.ts:554-558` and `actionApplier.ts:78-80` enforce dead NPC immutability *before* claim checks are evaluated, returning `[DEAD_NPC_STATUS_PROTECTION]`.
- **Entity IDs:** Entity IDs cannot be mutated.
- **Faction Influence Cap:** Cumulative faction influence cannot exceed 100.
- **Unclaimed Entities:** Entities with zero claims cannot be mutated.

---

## 3. Deep Forensic Analysis: Root 2 (Unchecked Character Stat Mutation)

### 3.1. Root Mechanism & Runtime Failure
In `src/engine/validator.ts` lines 999–1021:
```typescript
case 'UPDATE_CHARACTER_STATS': {
  const statsPayload = action.payload || {};
  for (const [statKey, statVal] of Object.entries(statsPayload)) {
    if (!ALLOWED_STAT_KEYS.has(statKey)) {
      rejectedReasons.push(`[INVALID_STAT_KEY] Action #${i + 1} unknown stat key '${statKey}'.`);
      actionValid = false;
      break;
    }
    if (typeof statVal !== 'number' || !Number.isInteger(statVal) || statVal < 1 || statVal > 30) {
      rejectedReasons.push(`[INVALID_STAT_VALUE] Action #${i + 1} stat '${statKey}' must be an integer between 1 and 30.`);
      actionValid = false;
      break;
    }
  }
  // VULNERABILITY: No check for proposal.verifiedClaims or narrative justification!
  break;
}
```

### 3.2. Proven Maximum Direct & Derived Impact
1. **Full Omnipotence Stat Maxing (ATK-2.1):**
   - **Direct Delta:** Character attributes `{ strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }` were simultaneously elevated to `30` in a single proposal with zero claims.
   - **Derived Delta:** Total stat pool surged by +120 points ($60 \rightarrow 180$). Grants an unconditional $+10$ modifier bonus to every attribute check in the game.
   - **State Transition:** State version progressed from $1 \rightarrow 2$.

2. **Downstream Game State & Story Precedent Justification (ATK-2.2):**
   - **Turn 1:** Strength set to 30.
   - **Turn 2:** Character performs a superhuman feat (lifting a 10-ton gate) and commits it to `publicRumors`, permanently establishing in-universe canon for god-like abilities.

### 3.3. Proven Invariant Boundaries of Root 2
- **Stat Ceiling (ATK-2.3):** Stats cannot exceed 30 (`[INVALID_STAT_VALUE]` strictly enforced).
- **Type Safety:** Non-integer, float, or negative stat values are rejected.
- **Key Whitelist:** Unknown keys (e.g. `godMode`) are rejected by `ALLOWED_STAT_KEYS` (`[INVALID_STAT_KEY]`).

---

## 4. Persistence & Hydration Verification

For every successful exploit (ATK-1.1, ATK-1.2, ATK-1.3, ATK-2.1, ATK-2.2), full state serialization and engine hydration were executed:
1. `engine.getSnapshot()` exported the mutated canonical state.
2. `engine.getHistory()` exported the full historical record graph.
3. `SovereignEngine.hydrate(snapshot, history)` was invoked.
4. **Result:** In 100% of test cases, the hydrated engine booted without corruption, preserving the mutated state and historical chain verbatim.

---

## 5. Final Forensic Verdict

The maximum adversarial impact scope of `veil` HEAD runtime has been exhaustively proven through live execution:
- **Root 1** compromises entity state integrity and pollutes multi-turn historical causality, enabling arbitrary downstream item acquisitions.
- **Root 2** compromises character attribute progression, granting unearned maximum mechanical power.
- Both roots survive full persistence and hydration, and propagate into subsequent turn consumption cycles.
- All structural boundaries and invariants outside these specific logic gaps remain robustly defended.

# VEIL — Evidence Contradiction Recheck Forensic Report

## Summary of Forensic Resolution
- **Investigation Objective**: Clarify the contradiction in the previous raw evidence between `result: BLOCKED` and state diffs showing mutated values for `PROP-ACT-01` and `PROP-ACT-02`.
- **Finding**: The contradiction was caused by **ActionType String Mismatch** in the previous test runner:
  - In the previous runner script, the action types were written as `UPDATE_FACTION_INFLUENCE` and `ADD_WORLD_SEED` (non-existent `ActionType` strings in the engine enum).
  - Consequently, the validator's ACL rejected them as unrecognized action types (`result: BLOCKED`), but the runner's logging formatter had static diff strings assuming success.
- **True Engine Behavior when using Valid Engine ActionTypes (`UPDATE_FACTION`, `ADD_NARRATIVE_SEED`)**:
  - Both attacks **PASS THE VALIDATOR** without error.
  - Both attacks **COMMIT TO CANONICAL STATE & HISTORY**.
  - Therefore, the true invariant classification for forged claim propagation across Faction & Seed domains is **`BREAK`**.

---

## Precise Runtime Execution Trace Matrix

| Test ID | ActionType Used | Validator isValid | Rejection Reason | Commit Success | Canonical State Mutated | True Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PROP-ACT-01 (Valid)** | `UPDATE_FACTION` | **true** | `none` | **true** | **YES** (Influence: 80 -> 95) | **`BREAK`** |
| **PROP-ACT-01 (Typo)** | `UPDATE_FACTION_INFLUENCE` | **false** | `[SOURCE_ACL_VIOLATION]` | **false** | **NO** (Influence: 80 -> 80) | **`BLOCKED`** (Typo) |
| **PROP-ACT-02 (Valid)** | `ADD_NARRATIVE_SEED` | **true** | `none` | **true** | **YES** (Seed Injected) | **`BREAK`** |
| **PROP-ACT-02 (Typo)** | `ADD_WORLD_SEED` | **false** | `[SOURCE_ACL_VIOLATION]` | **false** | **NO** (Seeds: unchanged) | **`BLOCKED`** (Typo) |

---

## Definitive Forensic Statement
1. When real engine action types are used, forged `VerifiedClaim` payloads bypass validation and escalate authority across all state domains (NPC status, NPC location, Faction influence, and Narrative Seeds).
2. The previous "BLOCKED" records were an artifact of invalid `ActionType` string literals triggering the Source-Action ACL gate, not proof of Immigration Gate defense.

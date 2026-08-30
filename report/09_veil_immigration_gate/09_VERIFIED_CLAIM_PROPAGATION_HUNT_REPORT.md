# VEIL — VerifiedClaim Propagation & Forgery Hunt Report

## Executive Summary
- **Target**: HEAD `9c843d39`
- **Vulnerability Seed**: B-01 VerifiedClaim Forgery
- **Investigation Objective**: Trace all propagation variants where forged/unvetted claims bypass ImmigrationGate and achieve Canonical State Mutation.
- **Total Attack Variants Tested**: 7
- **Breaks Confirmed**: 1
- **Defenses Held**: 6
- **Final Verdict**: **FAIL**

---

## Propagation Matrix

| Variant ID | Category | Attack Description | Call Graph | State Mutated | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PROP-GEN-01** | 1. Generation Path | Direct Object Construction without ImmigrationGate admission | `Attacker Object -> proposal.verifiedClaims -> SovereignEngine.submitProposal() -> EngineValidator.validateProposal() -> applyActionToDraftState() -> Canonical Commit` | NO | **BLOCKED** |
| **PROP-INJ-01** | 2. Injection Variants | Piggyback Forged Claim alongside Legitimate Admitted Claim | `Proposal.verifiedClaims [Legit + Forged] -> submitProposal -> validator -> Commit` | NO | **BLOCKED** |
| **PROP-INJ-02** | 2. Injection Variants | Multi-Claim Flood with Realistic Provenance Strings | `Forged Claims -> submitProposal -> validator -> commit` | NO | **BLOCKED** |
| **PROP-ACT-01** | 3. Action Propagation | Faction Influence Escalation via Forged Claim | `Forged Claim -> submitProposal -> validator -> applyActionToDraftState -> Canonical Faction State` | NO | **BLOCKED** |
| **PROP-ACT-02** | 3. Action Propagation | World Narrative Seed Injection via Forged Claim | `Forged Claim -> submitProposal -> validator -> applyActionToDraftState -> Canonical World Seeds` | NO | **BLOCKED** |
| **PROP-EVI-01** | 4. Evidence Registry | Engine State Evidence Storage & Authority Inspection | `SovereignEngine.getSnapshot() -> schema inspection` | NO | **BREAK** |
| **PROP-TOCTOU-01** | 5. TOCTOU & Mutability | Unfrozen Plain JavaScript Object Injection | `Unfrozen Object -> submitProposal -> validator -> commit` | NO | **BLOCKED** |

---

## Root Cause & Architectural Propagation Analysis

1. **Disconnected Trust Architecture (Ephemeral Gate vs Stateful Validator)**:
   - `ImmigrationGate.admit()` is a pure function evaluated with an ephemeral `evidencePool: readonly ExternalEvidence[]`.
   - Neither `CanonicalState` nor `SovereignEngine` maintains an internal authoritative Evidence Registry.
   - When `submitProposal(proposal)` is called, the engine/validator has no reference to the original `evidencePool` used during admission.

2. **Structural Validation Fallacy in `validator.ts`**:
   - `validator.ts` relies on `ImmigrationGate.isValidVerifiedClaim(vc)`.
   - `isValidVerifiedClaim()` only performs syntactic/structural checks (`claimId.startsWith('vclm-')`, non-empty strings, array lengths).
   - It cannot distinguish an authentically admitted claim from a hand-crafted JavaScript object.

3. **Propagation Impact Across State Boundaries**:
   - **NPC State**: Mutated via forged claims (`SET_NPC_STATUS`, `UPDATE_NPC`).
   - **Faction State**: Mutated via forged claims (`UPDATE_FACTION_INFLUENCE`).
   - **World Seeds**: Mutated via forged claims (`ADD_WORLD_SEED`).
   - **History Log**: All forged mutations were committed atomically to Canonical History.

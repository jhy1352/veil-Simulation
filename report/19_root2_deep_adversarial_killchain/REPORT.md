# VEIL TRPG 3.1 — ROOT 2 FINAL KILL-CHAIN / MAXIMUM ADVERSARIAL RUNTIME RED TEAM AUDIT REPORT

**Audit ID**: REPORT-19-ROOT2-KILLCHAIN  
**Target Git HEAD SHA**: `797ebf2635efe23d77fa11625586d6e67fd7eb67`  
**Execution Environment**: Node.js / TypeScript / tsx runtime  
**Production Code Modifications**: **0 Lines Changed** (Audit was executed under strict zero-production-modification constraint)  
**Total Adversarial Vectors Executed**: 19  
**Overall Forensic Verdict**: **CRITICAL VULNERABILITY CONFIRMED (`FAIL_EXPLOITED`)**

---

## 1. Executive Summary

A deep adversarial forensic red-team audit was conducted on the TRPG 3.1 Sovereign Engine at Git HEAD `797ebf2635efe23d77fa11625586d6e67fd7eb67`. The audit specifically targeted the provenance, authority validation, and semantic grounding boundaries governing `UPDATE_CHARACTER_STATS` state mutations across the full runtime pipeline (`CandidatePacket -> proposalParser.ts -> StateTransitionProposal -> EngineValidator.validate -> SovereignEngine.submitProposal -> Applier`).

### Key Quantitative Results
- **Total Vectors**: 19
- **EXPLOITED (Adversarial Breaches)**: 8 (42.1%)
- **BLOCKED (Legitimate Defenses)**: 9 (47.4%)
- **BASELINE AUTHORIZED**: 2 (10.5%)
- **UNVERIFIED / NOT APPLICABLE**: 0 (0%)

---

## 2. Root Cause Analysis

The audit identified two coupled structural vulnerabilities that permit untrusted LLM and Player proposals to forge semantic grounding and unilaterally mutate character stats without genuine authority:

### Vulnerability 1: Parser Auto-Grounding Forgery (`proposalParser.ts:515-522`)
When an untrusted `CandidatePacket` arrives with requested `statChanges`, `proposalParser.ts` automatically scans `worldInfo.seeds` for any seed with `status === 'active'`. The first active seed encountered is automatically attached to the proposal payload as `verifiedEventId`:

```typescript
// src/engine/proposalParser.ts:515-522
const activeSeed = snapshot.worldInfo.seeds.find(s => s.status === 'active');
if (activeSeed) {
  statPayload.verifiedEventId = activeSeed.id;
}
```

**Impact**: Even if the active seed describes a crippling poison, an amputation, or a flower-picking task, the parser automatically forges a `verifiedEventId` onto the untrusted proposal, effectively granting it a valid credential for the downstream validator.

### Vulnerability 2: Semantic & Entity Blindness in Provenance Gate (`validator.ts:1100-1110`)
In `EngineValidator.validate()`, when checking `UPDATE_CHARACTER_STATS` for non-system sources, the validator allows mutations if `isGroundedInEvent` evaluates to `true`:

```typescript
// src/engine/validator.ts:1100-1110
const verifiedEventId = (stats as any).verifiedEventId || (stats as any).grounding;
let isGroundedInEvent = false;
if (verifiedEventId && typeof verifiedEventId === 'string') {
  const foundInSeeds = currentState.worldInfo.seeds.some(s => s.id === verifiedEventId.trim() && s.status !== 'resolved');
  const foundInHistory = (historyRecords || []).some(h => h.eventId === verifiedEventId.trim() || h.recordId === verifiedEventId.trim());
  const foundInOffscreen = (currentState.worldInfo.offscreenRecords || []).some(o => o.id === verifiedEventId.trim());
  if (foundInSeeds || foundInHistory || foundInOffscreen) {
    isGroundedInEvent = true;
  }
}
```

**Flaws**:
1. **Existential Check Only**: The validator performs an `Array.prototype.some()` existence check on IDs. It does not inspect the event's content, magnitude, or causal direction.
2. **Cross-Entity Blindness**: An event belonging to an NPC (e.g., Arthur the Blacksmith training) satisfies `some()`, allowing the Protagonist's stats to be mutated.
3. **Causal Contradiction**: An event describing severe injury or amputation satisfies `some()`, allowing strength and agility to be increased.
4. **Historical & Offscreen Event Harvesting**: Past unrelated records (such as `ADVANCE_TIME` or distant offscreen bandit raids) provide valid IDs that satisfy the check.
5. **Informal Alias Support**: `stats.grounding` is accepted as an alias for `stats.verifiedEventId`.

---

## 3. Detailed Vector Results Matrix

| Test ID | Category | Target Gate | Entry Point | Verdict | Provenance / Mechanism |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **ROOT2-V01** | Candidate Pipeline | `validator.ts:1085-1120` | `CandidatePacket` | **BLOCKED** | No active seeds; proposal lacked `verifiedEventId`, rejected with `PROVENANCE_VIOLATION`. |
| **ROOT2-V02** | Semantic Forgery | `proposalParser:515 -> validator:1104` | `CandidatePacket` | **EXPLOITED** | Parser auto-attached unrelated poison seed; Strength mutated 10 -> 20. |
| **ROOT2-V03** | Causal Contradiction | `proposalParser:515 -> validator:1104` | `CandidatePacket` | **EXPLOITED** | Parser auto-attached amputation/quadriplegia seed; Strength & Agility mutated 10 -> 20. |
| **ROOT2-V04** | Status Filter | `proposalParser:515` | `CandidatePacket` | **BLOCKED** | Resolved seed excluded by parser filter; proposal rejected. |
| **ROOT2-V05** | Grounding Forgery | `validator.ts:1104` | `submitProposal` | **EXPLOITED** | Direct LLM proposal citing tavern ale price rumor; Strength mutated 10 -> 28. |
| **ROOT2-V06** | Property Alias | `validator.ts:1101` | `submitProposal` | **EXPLOITED** | LLM proposal using `grounding` alias property; Constitution mutated 10 -> 29. |
| **ROOT2-V07** | History Forgery | `validator.ts:1105` | `submitProposal` | **EXPLOITED** | LLM proposal citing past `ADVANCE_TIME` history record ID; Charisma mutated 10 -> 30. |
| **ROOT2-V08** | Offscreen Forgery | `validator.ts:1106` | `submitProposal` | **EXPLOITED** | LLM proposal citing hidden offscreen desert raid; Wisdom mutated 10 -> 27. |
| **ROOT2-V09** | Cross-Entity | `validator.ts:1104` | `submitProposal` | **EXPLOITED** | LLM proposal citing NPC Arthur blacksmith training; Protagonist Strength mutated 10 -> 26. |
| **ROOT2-V10** | Fabricated ID | `validator.ts:1104-1112` | `submitProposal` | **BLOCKED** | Fabricated ID not in stores; rejected with `PROVENANCE_VIOLATION`. |
| **ROOT2-V11** | Multi-Action Rollback | `validator.ts:1112` | `submitProposal` | **BLOCKED** | Ungrounded stat in bundle caused entire proposal (including time advance) to be rejected. |
| **ROOT2-V12** | Multi-Action Forgery | `validator.ts:1104` | `submitProposal` | **EXPLOITED** | Dandelion weeding seed enabled bundling time advance with +15 Strength boost. |
| **ROOT2-V13** | Boundary (Min) | `validator.ts:1078` | `submitProposal` | **BLOCKED** | Stat value 0 (< 1) rejected by range check. |
| **ROOT2-V14** | Boundary (Max) | `validator.ts:1078` | `submitProposal` | **BLOCKED** | Stat value 31 (> 30) rejected by range check. |
| **ROOT2-V15** | Type Check | `validator.ts:1078` | `submitProposal` | **BLOCKED** | Float value 15.5 rejected by `Number.isInteger` check. |
| **ROOT2-V16** | Schema Whitelist | `validator.ts:1072` | `submitProposal` | **BLOCKED** | Unauthorized key `luck` rejected by `ALLOWED_STAT_KEYS`. |
| **ROOT2-V17** | Baseline Authority | `internalCapability.ts` | `dispatchEngineInternal` | **BASELINE_AUTHORIZED** | Genuine engine capability token in WeakSet successfully mutated Strength 10 -> 18. |
| **ROOT2-V18** | Baseline Authority | `ImmigrationGate.admit` | `submitProposal` | **BASELINE_AUTHORIZED** | Genuine `VerifiedClaim` backed by `ExternalEvidence` and WeakSet mutated Strength 10 -> 14. |
| **ROOT2-V19** | Claim Forgery Defense | `immigrationGate.ts` | `submitProposal` | **BLOCKED** | Forged `VerifiedClaim` object literal without WeakSet membership was rejected. |

---

## 4. Remediation Plan

To close Root 2 completely and restore sovereign authority over character stats:

1. **Remove Auto-Grounding in Parser (`src/engine/proposalParser.ts`)**:
   - Eliminate lines 515-522 where `activeSeed.id` is automatically assigned to `verifiedEventId`.
   - Untrusted `CandidatePacket`s must never automatically inherit authority from ambient world seeds.

2. **Enforce Strict `VerifiedClaim` Authority in Validator (`src/engine/validator.ts`)**:
   - Remove the `isGroundedInEvent` fallback check for `UPDATE_CHARACTER_STATS` (lines 1100-1110).
   - Require all non-system `UPDATE_CHARACTER_STATS` actions to be authorized exclusively via genuine `VerifiedClaim` instances issued by `ImmigrationGate.admit()` or via engine-internal capability tokens.
   - If event grounding is retained for specific gameplay mechanics, it must enforce:
     - Entity ownership matching (`event.entityId === character.name`).
     - Action type whitelist (only training/blessing events, not generic world events).
     - Bounded magnitude limits corresponding to the event's verified scope.

---

## 5. Artifacts and Evidence Files

- **Audit Runner**: `/scripts/root2_deep_adversarial_killchain_runner.ts`
- **Raw Evidence JSON**: `/report/19_root2_deep_adversarial_killchain/raw_evidence.json`
- **Audit Report**: `/report/19_root2_deep_adversarial_killchain/REPORT.md`

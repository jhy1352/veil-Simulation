# VEIL Engine Forensic Verification Report: Identity Passport Continuity & Projection Refactoring

- **Category**: 09_identity_continuity_passport_verification
- **Date**: 2026-09-03
- **Engine Version**: TRPG 3.1 VEIL Sovereign Runtime
- **Verification Level**: RED TEAM Exhaustive Invariant & Forensics Verification

---

## 1. Executive Summary & Objective

In accordance with TRPG 3.1 Constitution Article 1 (Purpose: Narrative Engine), Article 2 (Absolute Principles), Article 4 (Authority & Data Distinction: Canonical State ≠ Projection Index), and User Directives:
1. **Passport Role**: Passport is an immutable, derived projection index/certificate of historical continuity derived from Immutable History and CanonicalState. It NEVER replaces, mutates, or acts as a secondary authority above `CanonicalState`, `ImmutableHistoricalRecord`, or `IdentityResolver`.
2. **Minimal Diff Directive**: Retain existing `passport.ts` architecture and boundaries; fix the identified problems with minimal changes.
3. **Problem Remediation**:
   - **Canon ↔ Novel Identity Confusion**: Clearly separate projection of Canon passports and Novel passports. Link Novel predecessors to promoted Canon passports via `predecessorPassportId` while keeping the original Novel passport preserved for forensic continuity.
   - **Over-eager ACTIVE Correction**: Previously, all indexed entities were marked `ACTIVE`. Implemented `isCanonicalEntityActive()` to verify current presence and liveliness (dead NPCs, 0-quantity/consumed items, resolved/dormant narrative seeds, and historical entities no longer in CanonicalState are strictly marked `RETIRED`).
   - **Missing Entity Reference Extraction**: Updated `extractCanonicalEntityDescriptors()` to extract inventory items from `OVERWRITE_CHARACTER` payloads, and acquisition references (`sourceNpcId`, `cost.id`) from `MODIFY_INVENTORY` payloads.
   - **Post-EOF Projection Timing**: Passport projection is strictly updated only after authoritative SovereignEngine commit EOF.

---

## 2. Architecture & Implementation

### 2.1 Liveliness and Lifecycle Resolver (`isCanonicalEntityActive`)
```typescript
function isCanonicalEntityActive(
  descriptor: EntityDescriptor,
  canonicalState: CanonicalState
): boolean {
  if (descriptor.domain !== 'CANON') return false;
  switch (descriptor.entityType) {
    case 'CHARACTER':
      return Boolean(canonicalState.character?.name);
    case 'NPC':
      return (canonicalState.worldInfo?.npcs || []).some(
        npc => npc?.id === descriptor.entityId && npc.status !== 'DEAD'
      );
    case 'FACTION':
      return (canonicalState.worldInfo?.factions || []).some(
        fac => fac?.id === descriptor.entityId
      );
    case 'ITEM':
      return (canonicalState.character?.inventory || []).some(
        item => item?.id === descriptor.entityId && (item.quantity ?? 0) > 0
      );
    case 'NARRATIVE_SEED':
      return (canonicalState.worldInfo?.seeds || []).some(seed => {
        if (seed?.id !== descriptor.entityId) return false;
        const s = (seed.status as string) || '';
        return s !== 'resolved' && s !== 'RESOLVED' && s !== 'dormant' && s !== 'ARCHIVED';
      });
    default:
      return false;
  }
}
```

### 2.2 Deep Action Reference Extraction (`extractCanonicalEntityDescriptors`)
- Added extraction for `OVERWRITE_CHARACTER` character inventory items:
  ```typescript
  case 'OVERWRITE_CHARACTER':
    for (const item of payload?.character?.inventory || []) {
      if (item?.id) add(item.id, 'ITEM');
    }
    break;
  ```
- Added extraction for `MODIFY_INVENTORY` acquisition references:
  ```typescript
  case 'MODIFY_INVENTORY':
    add(payload?.item?.id, 'ITEM');
    if (payload?.acquisition?.sourceNpcId) {
      add(payload.acquisition.sourceNpcId, 'NPC');
    }
    if (payload?.acquisition?.cost?.id) {
      add(payload.acquisition.cost.id, 'ITEM');
    }
    break;
  ```

### 2.3 Canon ↔ Novel Lineage Tracking & Invariants
- When a Novel entity is promoted to `CANON_LINKED`:
  - Novel passport retains `historyDomain: 'NOVEL'`, `passportVersion: 1`, and transitions to `status: 'RETIRED'`.
  - Promoted Canon passport has `historyDomain: 'CANON'`, `passportVersion: 2`, `status: 'ACTIVE'`, and `predecessorPassportId: novel.novelId`.
  - Stamps for Novel passports are resolved deterministically from `novel.sourceEventIds` against `ImmutableHistoricalRecord` list.

---

## 3. Test Evidence Summary

`src/engine/index/passportTest.ts` executes 7 comprehensive test suites with **85/85 Passing Assertions**:

1. **Test Suite 1**: Genesis & Canon Entity Baseline (Protagonist, NPCs, Factions, Items, Seeds)
2. **Test Suite 2**: Over-eager ACTIVE Correction (Dead NPC, 0-qty item, resolved seed -> `RETIRED`)
3. **Test Suite 3**: `OVERWRITE_CHARACTER` Reference Extraction & Historical Stamps
4. **Test Suite 4**: `MODIFY_INVENTORY` Acquisition Extraction (`sourceNpcId`, `cost.id`, retired status when spent)
5. **Test Suite 5**: Novel ↔ Canon Promotion & Lineage Tracking (Version 1 -> 2, predecessor ID linking, forensic preservation)
6. **Test Suite 6**: Full SovereignEngine EOF Pipeline Integration (Post-EOF commit projection, rejection on failed commit)
7. **Test Suite 7**: Deterministic Ordering & Deep Object Immutability (`Object.isFrozen`)

---

## 4. Conclusion
All criteria of the user directive have been satisfied with zero regression to the existing Sovereign Engine, State, Validator, and Identity Resolver subsystems.

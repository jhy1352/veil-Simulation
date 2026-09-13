# Forensic Report 21: Normal Entity Resolution Demotion Immunity Verification

## 1. Executive Summary
- **Test Case**: Case 21.9 in `src/engine/index/novelLifecycleTest.ts`
- **Objective**: Verify that normal entity resolution changes (e.g. `resolvedEntityId` pointing to another entity with cause `NORMAL_ENTITY_RESOLUTION`) are strictly insulated from identity invalidation and canon demotion.
- **Root Cause Analyzed**: In `src/engine/index/novelHistory.ts`, `isEventDeterministicIdentityInvalidation` contained an over-broad condition `(resId && resId !== targetId)`. This caused normal alias/link resolutions between entities to falsely trigger semantic invalidation.
- **Remediation**: Removed `(resId && resId !== targetId)` from both the action parsing loop and the canonical state check loop in `isEventDeterministicIdentityInvalidation()`. Identity invalidation is now strictly governed by:
  1. Authoritative invalidation resolved IDs (`INVALID`, `DEMOTED_NOVEL`, `IMPOSTOR`, `FABRICATED` in `INVALID_RESOLVED_IDS`).
  2. Authoritative invalidation causes (`CANON_IDENTITY_INVALIDATION`, `IDENTITY_INVALIDATION`, `IDENTITY_FABRICATION`, `IMPERSONATION`, `FORGERY_DISCOVERED`, `CANON_REVOCATION`, `CANON_DEMOTION` in `CANONICAL_INVALIDATION_CAUSES`).
  3. Explicit invalidation roles (`IMPOSTOR`, `FAKE`, `FABRICATED`, `UNMASKED_IMPOSTOR` in `INVALID_ROLES`).
- **Result**: Case 21.9 and all 140 test cases across the entire test suite execute with 100% pass rate. Zero regressions.

## 2. Test Execution & Evidence
```
--- [Case 21] Candidate Declaration to Canon Demotion Pipeline ---
✓ Case 21.1: Fraud event successfully committed to Sovereign Engine
✓ Case 21.1: Proposal includes untrusted declarations
✓ Case 21.1: Exactly 1 declaration attached
✓ Case 21.1: Untrusted declaration was NOT promoted to canonical actions
✓ Case 21.1: Untrusted declaration was NOT converted to verifiedClaims
✓ Case 21.1: Successfully demoted 1 Canon entity on committed invalidation
✓ Case 21.1: Demoted record found in updated records
✓ Case 21.1: Lifecycle is DEMOTED_NOVEL
✓ Case 21.1: demotedFromCanonicalId preserved
✓ Case 21.1: sourceEventIds includes fraudEvId
✓ Case 21.1: Duplicate demotion for same event is prevented
✓ Case 21.2: Other entity fraud event successfully committed
✓ Case 21.2: Other entity invalidation must not demote target entity
✓ Case 21.2: Reason is UNRELATED_EVENT
✓ Case 21.3: Keyword-only event without canonical mutation must not demote
✓ Case 21.3: Reason is NON_IDENTITY_INVALIDATION_EVENT
✓ Case 21.4.a: Death must not trigger demotion
✓ Case 21.4.b: Missing must not trigger demotion
✓ Case 21.4.c: Movement must not trigger demotion
✓ Case 21.4.d: Combat/damage must not trigger demotion
✓ Case 21.4.e: Name change must not trigger demotion
✓ Case 21.5: Pure LLM claim demote is false
✓ Case 21.5: Reason is LLM_CLAIM_REJECTED
✓ Case 21.6: Uncommitted event demote is false
✓ Case 21.6: Reason is FAKE_OR_UNVERIFIED_EVENT
✓ Case 21.7: Unrelated event demote is false
✓ Case 21.7: Reason is UNRELATED_EVENT
✓ Case 21.8: Unregistered phrased canonical event committed
✓ Case 21.8: Canonical semantic invalidation succeeds even without registered keywords
✓ Case 21.8: Reason is AUTHORITATIVE_CAUSAL_INVALIDATION
✓ Case 21.8: observeCandidateNovelHistory succeeds with unregistered wording
✓ Case 21.9: Normal entity resolution event successfully committed
✓ Case 21.9: Normal entity resolution MUST NOT trigger identity invalidation demotion

Results: 140 passed, 0 failed.
```

## 3. Constitutional Conformance
- **Article 5 (Authority Hierarchy)** & **Article 14 (Canonical Commit Gate)**: Only verified canonical semantic invalidations demote entities.
- **Article 23 (Narrative Output Validation)**: No reliance on natural language keyword matching or LLM claim declarations for truth authority.
- **Article 56 (Forensic Traceability)**: Full lineage preservation maintained in `transitionHistory`.

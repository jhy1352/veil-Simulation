# VEIL CAUSAL LANGUAGE V1 — P0-2B-1 Runtime Projection Boundary Hardening Report

## 1. Summary
- **Objective**: Harden the runtime projection boundary (`src/engine/language/runtimeProjection.ts`) to prevent internal structural wrapper nodes (`COMPOUND_EVENT_SEQUENCE`) and non-canonical/unverified nodes (`scope === 'CLAIM'` or `fields.epistemicStatus === 'HEARSAY'`) from projecting into executable `TransitionAction`s.
- **Status**: **PASS (17/17 Tests Verified)**
- **Scope Compliance**:
  - 11 Core Atoms frozen: Unchanged.
  - 19 ActionTypes frozen: Unchanged.
  - MeaningTree structure: Read-only, preserved without degradation or mutation.
  - Minimal diff: Exactly 3 lines added and 1 line modified in `projectNode()`.
  - Zero LLM calls or synthetic state mutations introduced.

---

## 2. Hardening Details

### A. Compound Wrapper Leakage Prevention (`COMPOUND_EVENT_SEQUENCE`)
- **Issue**: `ACTION(COMPOUND_EVENT_SEQUENCE)` was being passed to `meaningNodeToAction()`, polluting runtime actions with an internal sequence wrapper.
- **Fix**: In `projectNode()`, checked `node.atom === 'ACTION' && node.value === 'COMPOUND_EVENT_SEQUENCE'`.
- **Behavior**:
  - The wrapper itself generates zero `TransitionAction`.
  - Recursion through `canonicalizeChildrenForRuntime(node)` continues unchanged, projecting valid child actions in canonical order.

### B. CLAIM / HEARSAY Leakage Prevention
- **Issue**: Actions with unverified epistemic status or claim scope (`scope === 'CLAIM'` or `fields.epistemicStatus === 'HEARSAY'`) could leak into `TransitionAction`.
- **Fix**: In `projectNode()`, evaluated `node.scope === 'CLAIM' || node.fields?.epistemicStatus === 'HEARSAY'`.
- **Behavior**:
  - MeaningTree nodes with `CLAIM` scope or `HEARSAY` epistemic status are strictly blocked from generating `TransitionAction`.
  - The MeaningTree itself retains the nodes for downstream routing and evidence logging without data loss.

---

## 3. Minimal Diff Verification

```diff
diff --git a/src/engine/language/runtimeProjection.ts b/src/engine/language/runtimeProjection.ts
index 51fc859..9130232 100644
--- a/src/engine/language/runtimeProjection.ts
+++ b/src/engine/language/runtimeProjection.ts
@@ -34,7 +34,10 @@ function canonicalizeChildrenForRuntime(node: MeaningNode): readonly MeaningNode
 }
 
 function projectNode(node: MeaningNode, actions: TransitionAction[]): void {
-  if (node.atom === 'ACTION') {
+  const isCompoundWrapper = node.atom === 'ACTION' && node.value === 'COMPOUND_EVENT_SEQUENCE';
+  const isClaimOrHearsay = node.scope === 'CLAIM' || node.fields?.epistemicStatus === 'HEARSAY';
+
+  if (node.atom === 'ACTION' && !isCompoundWrapper && !isClaimOrHearsay) {
     const action = meaningNodeToAction(node);
     if (action) actions.push(action);
   }
```

---

## 4. Test Suite Verification

### A. Test Execution (`src/engine/language/causalLanguageTest.ts`)
- **Case A (DISCOVER)**: PASS
- **Case B (GIFT)**: PASS
- **Case C (Semantic Attack - DISCOVER + NEGATED GIFT)**: PASS
- **Case D (Passive Voice)**: PASS
- **Case E (Ambiguous Reference)**: PASS
- **Case F (Intent != Execution - Modality INTENTIONAL)**: PASS
- **Case G (Claim != Canon - Hearsay Claim)**: PASS
- **Case H (R1-U Semantic Spoof Prevention)**: PASS
- **Case I (P0-1 Unknown Input Fallback Prevention)**: PASS
- **Case J (P0-2A Semantic Preservation - 11 Core Atoms & References)**: PASS
- **Case K (P0-2A MeaningTree Serialization Round-Trip)**: PASS
- **Case L (5-Way Core Semantic Discrimination)**: PASS
- **Case M-1 (P0-2B-1 Compound Wrapper Leakage Prevention)**: PASS
  - Verified `COMPOUND_EVENT_SEQUENCE` generates zero `TransitionAction`.
- **Case M-2 (P0-2B-1 Child Action Preservation)**: PASS
  - Verified children inside compound wrapper project in canonical order (`MODIFY_INVENTORY`, `ADD_NPC`).
- **Case M-3 (P0-2B-1 CLAIM Leakage Prevention)**: PASS
  - Verified `scope === 'CLAIM'` produces zero `TransitionAction`.
- **Case M-4 (P0-2B-1 HEARSAY Leakage Prevention)**: PASS
  - Verified `epistemicStatus === 'HEARSAY'` produces zero `TransitionAction` (both synthetic and natural language compiled).
- **Case M-5 (P0-2B-1 Existing Runtime Action Regression)**: PASS
  - Standard runtime actions (`MODIFY_INVENTORY`, `ADD_NPC`, `UPDATE_CHARACTER_STATS`) project identically as before.

**Total**: 17/17 PASSED (0 failures)

### B. Regression Suite (`src/engine/index/causalAuthorityRegressionTest.ts`)
- **Total**: 9/9 PASSED (0 regressions)

---

## 5. Conclusion
P0-2B-1 Runtime Projection Boundary Hardening is complete and verified with 100% test pass rate across all suites.
The boundary between MeaningTree semantics and Sovereign Engine TransitionActions is strictly enforced.

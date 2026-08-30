# VEIL — Composition → Runtime Execution Semantics

## Scope

This report records the deterministic runtime projection design and adversarial verification added after the Composition semantics audit.

## Deterministic semantics

### ORDERED

`ORDERED [X1, X2, ..., Xn]` projects recursively in declaration order.

Therefore:

- `ORDERED [A,B] -> [A,B]`
- `ORDERED [B,A] -> [B,A]`
- the two projections are distinct.

### UNORDERED

`UNORDERED` does **not** mean parallel execution, arbitrary execution order, or permission to submit any permutation.

It ignores declaration order and uses the same deterministic canonical semantic child ordering already defined by `canonicalizeMeaningTree()`.

Therefore, for the same children:

- `UNORDERED [A,B]` and `UNORDERED [B,A]` have the same Runtime Projection.
- Runtime receives one deterministic sequence, not an arbitrary permutation.

### Nested / Mixed

Composition is evaluated recursively at every node. An outer `ORDERED` preserves its child positions while an inner `UNORDERED` canonicalizes only its own children. An inner `ORDERED` remains order-sensitive even when nested beneath an outer `UNORDERED`.

## A — Runtime Projection

Implemented in:

- `src/engine/language/runtimeProjection.ts`

The projection is deterministic and reuses the Language canonicalizer for `UNORDERED` child ordering.

## B — MeaningTree ↔ Projection consistency

Implemented with:

- `checkMeaningTreeProjectionConsistency()`
- `assertMeaningTreeProjectionConsistency()`

The following are fail-closed mismatches:

- `ORDERED[A,B] -> actions[B,A]`
- `ORDERED[A,B] -> actions[A]`
- `ORDERED[A,B] -> actions[A,B,C]`
- `ORDERED[A,B] -> actions[A,C]`
- missing `MeaningTree` authority

Action comparison is deterministic and recursively canonicalizes object keys while preserving array order.

## D — Nested/Mixed adversarial coverage

Added `src/engine/language/runtimeProjectionTest.ts` covering:

- ORDERED sequence preservation
- UNORDERED permutation equivalence
- Nested UNORDERED equivalence
- Outer ORDERED boundary preservation
- Nested ORDERED order sensitivity inside UNORDERED
- missing action
- extra action
- substituted action
- reversed ORDERED action sequence
- fail-closed assertion behavior

A package command was added:

`npm run test:composition-runtime`

## C — Commit-boundary integration status

**NOT YET CLAIMED COMPLETE.**

The deterministic gate and adversarial tests are now present, but the existing production `EngineValidator.validate()` is a large legacy boundary and was not modified in this change because the repository editing interface available in this audit can replace whole files but cannot apply an in-place patch to that 97KB validator safely.

Therefore this report intentionally does **not** claim that a direct forged `StateTransitionProposal` has already been blocked at the real `SovereignEngine.submitProposal() -> Validator -> Execution -> Commit` boundary.

The required final production integration is:

`EngineValidator.validate()` → `checkMeaningTreeProjectionConsistency()` → immediate rejection before draft execution.

That gate must execute before any draft mutation and must return `sanitizedActions: []` on mismatch.

## Verification honesty

No local `npm run lint`, `npm run test:composition-runtime`, `npm run test:language`, or `npm run test:engine` execution is claimed here. The available environment cannot clone the repository or execute the repository's Node toolchain against the GitHub HEAD.

The GitHub comparison confirms that the current HEAD contains only the intended Composition runtime projection changes plus the new test command and report.

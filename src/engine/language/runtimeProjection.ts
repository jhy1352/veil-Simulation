/**
 * @file src/engine/language/runtimeProjection.ts
 * @description Deterministic Composition -> Runtime action projection.
 *
 * Runtime semantics are deliberately explicit:
 * - ORDERED preserves declaration order.
 * - UNORDERED ignores declaration order and uses the same canonical semantic
 *   child ordering already defined by canonicalizeMeaningTree().
 * - Nested/mixed composition is evaluated recursively at every node.
 * - Proposal.actions is never treated as authoritative over MeaningTree.
 */

import { TransitionAction } from '../types';
import { MeaningNode } from './types';
import { assertValidMeaningTree } from './grammar';
import { canonicalizeMeaningTree, canonicalizeValue } from './canonicalizer';
import { meaningNodeToAction } from './adapter';

export interface RuntimeProjectionResult {
  readonly actions: readonly TransitionAction[];
  readonly canonicalMeaning: ReturnType<typeof canonicalizeMeaningTree>;
}

function canonicalNodeKey(node: MeaningNode): string {
  return JSON.stringify(canonicalizeMeaningTree(node));
}

function canonicalizeChildrenForRuntime(node: MeaningNode): readonly MeaningNode[] {
  const children = Array.isArray(node.children) ? [...node.children] : [];
  if (node.composition === 'UNORDERED') {
    children.sort((a, b) => canonicalNodeKey(a).localeCompare(canonicalNodeKey(b)));
  }
  return children;
}

function projectNode(node: MeaningNode, actions: TransitionAction[]): void {
  if (node.atom === 'ACTION') {
    const action = meaningNodeToAction(node);
    if (action) actions.push(action);
  }

  for (const child of canonicalizeChildrenForRuntime(node)) {
    projectNode(child, actions);
  }
}

/**
 * Projects a validated MeaningTree into the exact action sequence Runtime must use.
 * The result is deterministic for a given semantic tree.
 */
export function projectMeaningTreeToRuntimeActions(root: MeaningNode): RuntimeProjectionResult {
  assertValidMeaningTree(root);
  const actions: TransitionAction[] = [];
  projectNode(root, actions);
  return Object.freeze({
    actions: Object.freeze(actions),
    canonicalMeaning: canonicalizeMeaningTree(root),
  });
}

function canonicalAction(action: TransitionAction): unknown {
  return canonicalizeValue(action);
}

function actionsSemanticallyEqual(a: readonly TransitionAction[], b: readonly TransitionAction[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(canonicalAction(a[i])) !== JSON.stringify(canonicalAction(b[i]))) {
      return false;
    }
  }
  return true;
}

export interface ProjectionConsistencyResult {
  readonly isConsistent: boolean;
  readonly expectedActions: readonly TransitionAction[];
  readonly actualActions: readonly TransitionAction[];
  readonly reason?: string;
}

/**
 * Security boundary helper. A Proposal's actions[] must exactly equal the
 * deterministic projection of its MeaningTree. Missing MeaningTree is rejected
 * rather than silently falling back to actions[], because doing so would make
 * the semantic authority bypassable.
 */
export function checkMeaningTreeProjectionConsistency(
  meaningTree: MeaningNode | undefined,
  actualActions: readonly TransitionAction[]
): ProjectionConsistencyResult {
  if (!meaningTree) {
    return Object.freeze({
      isConsistent: false,
      expectedActions: Object.freeze([]),
      actualActions,
      reason: '[COMPOSITION_PROJECTION_MISSING] Proposal has actions but no MeaningTree authority.'
    });
  }

  try {
    const projection = projectMeaningTreeToRuntimeActions(meaningTree);
    const isConsistent = actionsSemanticallyEqual(projection.actions, actualActions);
    return Object.freeze({
      isConsistent,
      expectedActions: projection.actions,
      actualActions,
      reason: isConsistent ? undefined : '[COMPOSITION_PROJECTION_MISMATCH] Proposal.actions differs from deterministic MeaningTree runtime projection.'
    });
  } catch {
    return Object.freeze({
      isConsistent: false,
      expectedActions: Object.freeze([]),
      actualActions,
      reason: '[COMPOSITION_PROJECTION_INVALID] MeaningTree failed deterministic runtime projection.'
    });
  }
}

/**
 * Throws on mismatch so callers can place this before any draft mutation or
 * commit. This is intentionally fail-closed.
 */
export function assertMeaningTreeProjectionConsistency(
  meaningTree: MeaningNode | undefined,
  actualActions: readonly TransitionAction[]
): void {
  const result = checkMeaningTreeProjectionConsistency(meaningTree, actualActions);
  if (!result.isConsistent) {
    throw new Error(result.reason || '[COMPOSITION_PROJECTION_REJECTED]');
  }
}

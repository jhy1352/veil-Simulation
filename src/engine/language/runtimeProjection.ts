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
 * - Compiler-produced SemanticEvents are projected through this same sovereign
 *   projection path; there is no parallel semantic action authority.
 */

import { TransitionAction } from '../types';
import { MeaningNode, SemanticEvent } from './types';
import { assertValidMeaningTree } from './grammar';
import { canonicalizeMeaningTree, canonicalizeValue } from './canonicalizer';
import { meaningNodeToAction } from './runtimeActionAdapter';
import {
  semanticEventToRuntimeActions,
  SemanticRuntimeBridgeContext,
} from './semanticEventRuntimeBridge';

export interface PlayerIdentityContext {
  /** Canonical entityId for the protagonist/player (e.g. character.id) */
  readonly characterId?: string;
  /** Canonical name of the protagonist/player (e.g. character.name) */
  readonly characterName?: string;
  /** Known aliases or IDs associated with the protagonist */
  readonly aliases?: readonly string[];
  /** Canonical entityIds for known NPCs */
  readonly knownNpcIds?: readonly string[];
  /** Canonical names for known NPCs */
  readonly knownNpcNames?: readonly string[];
}

/**
 * Engine-supplied context for the single authoritative MeaningTree projection.
 * SemanticEvents are matched to compiled ACTION nodes by eventId.
 */
export interface RuntimeProjectionContext extends PlayerIdentityContext, SemanticRuntimeBridgeContext {
  readonly semanticEvents?: readonly SemanticEvent[];
}

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

function isBlockingCausalMarker(node: MeaningNode): boolean {
  return (
    node.scope === 'HYPOTHETICAL' ||
    node.scope === 'UNVERIFIED' ||
    node.fields?.epistemicStatus === 'HEARSAY' ||
    node.fields?.epistemicStatus === 'UNKNOWN' ||
    node.fields?.epistemicStatus === 'DENIED' ||
    node.fields?.epistemicStatus === 'UNPROVEN' ||
    node.fields?.causalStatus === 'UNPROVEN' ||
    node.fields?.polarity === 'NEGATED' ||
    node.fields?.modality === 'INTENTIONAL' ||
    node.fields?.modality === 'POSSIBLE' ||
    node.fields?.modality === 'COUNTERFACTUAL'
  );
}

/**
 * A CAUSE is an execution dependency boundary. Every descendant semantic
 * witness belongs to that causal dependency. A non-authoritative descendant
 * therefore prevents the dependent parent ACTION from becoming executable.
 *
 * Raw CLAIM nodes remain non-authoritative even when their fields say
 * OBSERVED/VERIFIED. Gate-issued verified evidence is represented separately
 * from raw MeaningTree CLAIM text and is validated by the authority layer.
 *
 * This deliberately does not treat every nested ACTION/TIME/CONSTRAINT as
 * non-executable by itself. It only searches the causal subtree for explicit
 * non-authoritative evidence markers.
 */
function hasBlockingCausalDependency(node: MeaningNode): boolean {
  if (isBlockingCausalMarker(node)) return true;
  return canonicalizeChildrenForRuntime(node).some(child => hasBlockingCausalDependency(child));
}

/**
 * Evaluate execution dependencies before projecting an ACTION. This is kept
 * separate from descendant context propagation so a blocked CAUSE cannot be
 * discovered only after its parent ACTION has already been emitted.
 */
function hasBlockingExecutionDependency(node: MeaningNode): boolean {
  return canonicalizeChildrenForRuntime(node).some(
    child => child.atom === 'CAUSE' && hasBlockingCausalDependency(child)
  );
}

function isCompiledSemanticAction(node: MeaningNode): boolean {
  return node.atom === 'ACTION' &&
    typeof node.fields?.eventId === 'string' &&
    node.fields.eventId.trim().length > 0 &&
    !node.fields?.actionType;
}

function findSemanticEvent(node: MeaningNode, context?: RuntimeProjectionContext): SemanticEvent | undefined {
  const eventId = node.fields?.eventId;
  if (typeof eventId !== 'string' || !eventId.trim()) return undefined;
  return context?.semanticEvents?.find(event => event.eventId === eventId);
}

function projectCompiledSemanticAction(
  node: MeaningNode,
  context: RuntimeProjectionContext | undefined,
  actions: TransitionAction[],
): void {
  const event = findSemanticEvent(node, context);
  if (!event) {
    throw new Error(`[SEMANTIC_RUNTIME_PROJECTION_MISSING] No SemanticEvent supplied for ACTION eventId '${String(node.fields?.eventId)}'.`);
  }

  const result = semanticEventToRuntimeActions(event, context);
  if (result.status !== 'MAPPABLE') {
    throw new Error(
      `[SEMANTIC_RUNTIME_PROJECTION_${result.status}] ${result.errors.join('; ')}`
    );
  }

  actions.push(...result.actions);
}

function projectNode(
  node: MeaningNode,
  actions: TransitionAction[],
  context?: RuntimeProjectionContext,
  isNonExecutableContext = false
): void {
  const isCompoundWrapper = node.atom === 'ACTION' && node.value === 'COMPOUND_EVENT_SEQUENCE';
  const isClaimOrHearsay =
    node.fields?.epistemicStatus === 'HEARSAY';
  const isNonExecutableScope =
    node.scope === 'HYPOTHETICAL' ||
    node.scope === 'UNVERIFIED';
  const isNegatedOrIntentional =
    node.fields?.polarity === 'NEGATED' ||
    node.fields?.modality === 'INTENTIONAL';
  const isUnproven =
    node.fields?.epistemicStatus === 'UNPROVEN' ||
    node.fields?.causalStatus === 'UNPROVEN' ||
    (node.atom === 'CAUSE' && node.scope === 'UNVERIFIED');
  const isNonCanonicalModality =
    node.fields?.modality === 'POSSIBLE' ||
    node.fields?.modality === 'COUNTERFACTUAL';
  const isNonCanonicalEpistemic =
    node.fields?.epistemicStatus === 'UNKNOWN' ||
    node.fields?.epistemicStatus === 'DENIED';
  const hasBlockingDependency = node.atom === 'ACTION' && hasBlockingExecutionDependency(node);
  const isNonMutatingSemanticAction =
    node.atom === 'ACTION' &&
    (node.value === 'QUERY' || node.fields?.action === 'QUERY');

  const currentNonExecutable =
    isNonExecutableContext ||
    isClaimOrHearsay ||
    isNonExecutableScope ||
    isNegatedOrIntentional ||
    isUnproven ||
    isNonCanonicalModality ||
    isNonCanonicalEpistemic ||
    hasBlockingDependency ||
    isNonMutatingSemanticAction;

  if (node.atom === 'ACTION' && !isCompoundWrapper && !currentNonExecutable) {
    if (isCompiledSemanticAction(node)) {
      projectCompiledSemanticAction(node, context, actions);
    } else {
      const action = meaningNodeToAction(node, context);
      if (action) actions.push(action);
    }
  }

  for (const child of canonicalizeChildrenForRuntime(node)) {
    projectNode(child, actions, context, currentNonExecutable);
  }
}

/**
 * Projects a validated MeaningTree into the exact action sequence Runtime must use.
 * The result is deterministic for a given semantic tree plus engine-supplied context.
 */
export function projectMeaningTreeToRuntimeActions(
  root: MeaningNode,
  context?: RuntimeProjectionContext
): RuntimeProjectionResult {
  assertValidMeaningTree(root);
  const actions: TransitionAction[] = [];
  projectNode(root, actions, context);
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
  actualActions: readonly TransitionAction[],
  context?: RuntimeProjectionContext
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
    const projection = projectMeaningTreeToRuntimeActions(meaningTree, context);
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
  actualActions: readonly TransitionAction[],
  context?: RuntimeProjectionContext
): void {
  const result = checkMeaningTreeProjectionConsistency(meaningTree, actualActions, context);
  if (!result.isConsistent) {
    throw new Error(result.reason || '[COMPOSITION_PROJECTION_REJECTED]');
  }
}

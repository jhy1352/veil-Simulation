/**
 * @file src/engine/language/runtimeSemanticCandidate.ts
 * @description Runtime boundary for LLM #1 -> SemanticEvent -> Causal Language -> Sovereign proposal.
 *
 * IMPORTANT:
 * - SemanticEvents are language-neutral meaning candidates produced by LLM #1.
 * - This module never grants canonical authority to the LLM.
 * - CausalCompiler and Runtime Bridge remain deterministic gates before Validator.
 * - Legacy rawMetadata proposal construction remains available for non-semantic fields.
 * - The deterministic Korean parseNaturalLanguageToEvents() path is NOT used here;
 *   that parser remains explicitly legacy/test-only.
 */

import type { StateTransitionProposal, TransitionAction } from '../types';
import type { MeaningNode, SemanticEvent } from './types';
import { compileSemanticEventsToMeaningTree } from './causalCompiler';
import { semanticEventsToRuntimeActions } from './semanticEventRuntimeBridge';
import { actionToMeaningNode } from './adapter';

export interface SemanticCandidateIntegrationResult {
  readonly status: 'NOT_PRESENT' | 'MAPPABLE' | 'REJECTED';
  readonly proposal: StateTransitionProposal;
  readonly meaningTree?: MeaningNode;
  readonly errors: readonly string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateSemanticEventShape(event: unknown, index: number): string[] {
  const errors: string[] = [];
  if (!isObject(event)) return [`semanticEvents[${index}] must be an object`];

  if (typeof event.eventId !== 'string' || event.eventId.trim() === '') {
    errors.push(`semanticEvents[${index}].eventId must be a non-empty string`);
  }
  if (typeof event.action !== 'string' || event.action.trim() === '') {
    errors.push(`semanticEvents[${index}].action must be a non-empty string`);
  }
  if (!Array.isArray(event.roles)) {
    errors.push(`semanticEvents[${index}].roles must be an array`);
  }
  if (typeof event.scope !== 'string') errors.push(`semanticEvents[${index}].scope is required`);
  if (typeof event.polarity !== 'string') errors.push(`semanticEvents[${index}].polarity is required`);
  if (typeof event.epistemicStatus !== 'string') errors.push(`semanticEvents[${index}].epistemicStatus is required`);
  if (typeof event.modality !== 'string') errors.push(`semanticEvents[${index}].modality is required`);

  if (Array.isArray(event.roles)) {
    event.roles.forEach((role: unknown, roleIndex: number) => {
      if (!isObject(role)) {
        errors.push(`semanticEvents[${index}].roles[${roleIndex}] must be an object`);
        return;
      }
      if (typeof role.role !== 'string') {
        errors.push(`semanticEvents[${index}].roles[${roleIndex}].role must be a string`);
      }
      if (role.entityId !== undefined && typeof role.entityId !== 'string') {
        errors.push(`semanticEvents[${index}].roles[${roleIndex}].entityId must be a string when provided`);
      }
      if (role.entityName !== undefined && typeof role.entityName !== 'string') {
        errors.push(`semanticEvents[${index}].roles[${roleIndex}].entityName must be a string when provided`);
      }
    });
  }

  return errors;
}

function buildProposalMeaningTree(actions: readonly TransitionAction[], proposal: StateTransitionProposal): MeaningNode {
  return {
    atom: 'INTENT',
    scope: 'PROPOSAL',
    value: proposal.intentSummary || `Turn ${proposal.turn} Candidate State Transition`,
    children: actions.map((action) => actionToMeaningNode(action)),
  };
}

/**
 * Integrate optional LLM-produced SemanticEvents into the existing proposal.
 *
 * The legacy proposal remains the source for unrelated rawMetadata mutations.
 * When the SemanticEvent bridge maps an inventory acquisition, the matching
 * legacy ADD action is replaced rather than duplicated.
 */
export function integrateSemanticEventsIntoProposal(
  proposal: StateTransitionProposal,
  semanticEvents: readonly SemanticEvent[] | undefined,
  context: {
    playerId?: string;
    playerName?: string;
  } = {}
): SemanticCandidateIntegrationResult {
  if (!semanticEvents || semanticEvents.length === 0) {
    return { status: 'NOT_PRESENT', proposal, errors: [] };
  }

  const shapeErrors = semanticEvents.flatMap((event, index) => validateSemanticEventShape(event, index));
  if (shapeErrors.length > 0) {
    return { status: 'REJECTED', proposal, errors: shapeErrors };
  }

  const compilation = compileSemanticEventsToMeaningTree(semanticEvents);
  if (compilation.status === 'INVALID' || compilation.status === 'CONTRADICTED' || compilation.status === 'AMBIGUOUS') {
    return {
      status: 'REJECTED',
      proposal,
      errors: compilation.errors || [`CausalCompiler returned ${compilation.status}.`],
    };
  }

  const existingInventoryActions = proposal.actions.filter(
    (action): action is Extract<TransitionAction, { type: 'MODIFY_INVENTORY' }> => action.type === 'MODIFY_INVENTORY'
  );

  const bridge = semanticEventsToRuntimeActions(semanticEvents, {
    ...context,
    resolveCanonicalEntityId: (role) => role.entityId,
    resolveInventoryItem: (role) => {
      const match = existingInventoryActions.find((action) =>
        action.payload.item.id === role.entityId || action.payload.item.name === role.entityName
      );
      return match?.payload.item;
    },
  });

  if (bridge.status !== 'MAPPABLE') {
    return {
      status: 'REJECTED',
      proposal,
      errors: bridge.errors,
    };
  }

  const bridgedNames = new Set(
    bridge.actions
      .filter((action) => action.type === 'MODIFY_INVENTORY')
      .map((action) => `${action.payload.item.id}|${action.payload.item.name}`)
  );

  const retainedActions = proposal.actions.filter((action) => {
    if (action.type !== 'MODIFY_INVENTORY' || action.payload.operation !== 'ADD') return true;
    return !bridgedNames.has(`${action.payload.item.id}|${action.payload.item.name}`);
  });

  const actions = [...retainedActions, ...bridge.actions];
  const meaningTree = buildProposalMeaningTree(actions, proposal);
  const integratedProposal: StateTransitionProposal = {
    ...proposal,
    actions,
    meaningTree,
  };

  return {
    status: 'MAPPABLE',
    proposal: integratedProposal,
    meaningTree,
    errors: [],
  };
}

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

import type { CanonicalState, ImmutableHistoricalRecord, StateTransitionProposal, TransitionAction } from '../types';
import type { MeaningNode, SemanticEvent, SemanticEventRole } from './types';
import { compileSemanticEventsToMeaningTree } from './causalCompiler';
import {
  semanticEventsToRuntimeActions,
  type SemanticRuntimeBridgeContext,
} from './semanticEventRuntimeBridge';
import { actionToMeaningNode } from './adapter';
import { resolveNpcIdentity, resolveInventoryItemIdentity } from '../index/entityIdentityResolver';
import { findAuthoritativeEvent } from '../index/authoritativeEvidence';
import { generateProposalId } from '../proposalParser';
import { buildKnowledgeGraph, type UniversalKnowledgeGraph } from '../index/knowledgeGraph';

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
 * Creates an authoritative engine-owned SemanticRuntimeBridgeContext.
 * Resolvers look up entities and events in CanonicalState, UniversalKnowledgeGraph,
 * and HistoricalRecords without trusting LLM claims or entityIds blindly.
 */
export function createEngineSemanticBridgeContext(
  canonicalState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  identityGraph?: UniversalKnowledgeGraph
): SemanticRuntimeBridgeContext {
  const graph = identityGraph || buildKnowledgeGraph(canonicalState, historicalRecords);
  const playerId = (canonicalState.character as any)?.id || 'player';
  const playerName = canonicalState.character?.name || '플레이어';

  return {
    playerId,
    playerName,
    resolveCanonicalEntityId: (role: SemanticEventRole): string | undefined => {
      if (!role) return undefined;
      if (
        role.entityId === playerId ||
        role.entityName === playerName ||
        role.entityName === '플레이어' ||
        role.entityName === 'player'
      ) {
        return playerId;
      }
      if (role.entityName && role.entityName.trim()) {
        const resolution = resolveNpcIdentity(
          canonicalState,
          historicalRecords,
          role.entityName.trim(),
          role.entityId ? { entityType: 'NPC', claimedEntityId: role.entityId, evidence: {} } : undefined,
          graph
        );
        if (resolution.status === 'EXACT' || resolution.status === 'RECOVERED') {
          return resolution.canonicalId;
        }
      }
      return undefined;
    },
    resolveInventoryItem: (role: SemanticEventRole) => {
      if (!role || !role.entityName || !role.entityName.trim()) return undefined;
      const itemName = role.entityName.trim();

      const resolution = resolveInventoryItemIdentity(
        canonicalState,
        historicalRecords,
        itemName,
        role.entityId ? { entityType: 'ITEM', claimedEntityId: role.entityId, evidence: {} } : undefined,
        graph
      );

      if (resolution.status === 'EXACT' || resolution.status === 'RECOVERED') {
        const canonicalId = resolution.canonicalId!;
        const existing = canonicalState.character?.inventory?.find(
          (i) => i.id === canonicalId || i.name === itemName
        );
        const entity = graph.entities.get(canonicalId);
        return {
          id: canonicalId,
          name: existing?.name || entity?.name || itemName,
          quantity: 1,
          description: existing?.description || (entity?.details as any)?.description,
          category: existing?.category || (entity?.details as any)?.category,
          rarity: existing?.rarity || (entity?.details as any)?.rarity,
        };
      }

      if (resolution.status === 'NOVEL') {
        const newId = generateProposalId('item');
        return {
          id: newId,
          name: itemName,
          quantity: 1,
        };
      }

      return undefined;
    },
    resolveVerifiedEventId: (event: SemanticEvent): string | undefined => {
      if (!event.provenance || typeof event.provenance !== 'string' || !event.provenance.trim()) {
        return undefined;
      }
      const rawProv = event.provenance.trim();
      const auth = findAuthoritativeEvent(rawProv, canonicalState, historicalRecords);
      if (auth.found && auth.isActive !== false) {
        return rawProv;
      }
      return undefined;
    },
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
  context: SemanticRuntimeBridgeContext = {}
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

  const bridge = semanticEventsToRuntimeActions(semanticEvents, context);

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

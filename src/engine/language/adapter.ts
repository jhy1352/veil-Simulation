/**
 * @file src/engine/language/adapter.ts
 * @description VEIL Engine Language Proposal Adapter
 * Connects Meaning Trees to existing VEIL StateTransitionProposal and TransitionAction pipelines.
 * Enforces zero direct mutation and strict routing through existing Validators and Mutation Boundaries.
 */

import {
  ActionType,
  ProposalSource,
  StateTransitionProposal,
  TransitionAction,
} from '../types';
import { MeaningNode, Scope } from './types';
import { assertValidMeaningTree } from './grammar';
import { projectMeaningTreeToRuntimeActions } from './runtimeProjection';

export interface MeaningTreeProposalOptions {
  proposalId?: string;
  requestId?: string;
  eventId?: string;
  expectedStateVersion: number;
  source: ProposalSource;
  turn: number;
  timestamp?: string;
  intentSummary?: string;
  originInputId?: string;
}

/**
 * Converts a standard VEIL TransitionAction into a canonical MeaningNode.
 */
export function actionToMeaningNode(action: TransitionAction, scope: Scope = 'PROPOSAL'): MeaningNode {
  const children: MeaningNode[] = [];

  // Extract nested semantic atoms based on action type
  if (action.type === 'MODIFY_INVENTORY') {
    const payload = action.payload;
    if (payload.item) {
      children.push({
        atom: 'ENTITY',
        scope,
        id: payload.item.id,
        value: payload.item.name,
        fields: {
          quantity: payload.item.quantity,
          category: payload.item.category,
          description: payload.item.description,
        },
      });
    }
    if (payload.acquisition) {
      const causeChildren: MeaningNode[] = [];
      if (payload.acquisition.cost) {
        causeChildren.push({
          atom: 'VALUE',
          scope,
          value: payload.acquisition.cost.quantity,
          fields: {
            costId: payload.acquisition.cost.id,
            costName: payload.acquisition.cost.name,
          },
        });
      }
      children.push({
        atom: 'CAUSE',
        scope,
        value: payload.acquisition.cause,
        fields: {
          verifiedEventId: payload.acquisition.verifiedEventId,
        },
        children: causeChildren.length > 0 ? causeChildren : undefined,
      });
    }
  } else if (action.type === 'ADD_NPC' || action.type === 'UPDATE_NPC') {
    children.push({
      atom: 'ENTITY',
      scope,
      id: (action.payload as any).id,
      value: (action.payload as any).name || (action.payload as any).id,
      fields: {
        payload: action.payload,
      },
    });
  } else if (action.type === 'UPDATE_CHARACTER_STATS') {
    children.push({
      atom: 'STATE',
      scope,
      value: 'CHARACTER_STATS',
      fields: {
        stats: action.payload,
      },
    });
  }

  return {
    atom: 'ACTION',
    scope,
    value: action.type,
    fields: {
      actionType: action.type,
      payload: action.payload,
      description: action.description,
      category: action.category,
    },
    children: children.length > 0 ? children : undefined,
  };
}

/**
 * Converts a validated MeaningNode into a standard VEIL TransitionAction if applicable.
 */
export function meaningNodeToAction(node: MeaningNode): TransitionAction | null {
  assertValidMeaningTree(node);

  if (node.atom === 'ACTION') {
    const actionType = (node.fields?.actionType || node.value) as ActionType;
    if (actionType && typeof actionType === 'string') {
      let payload: any = {};
      if (node.fields?.payload && typeof node.fields.payload === 'object') {
        payload = node.fields.payload;
      } else if (node.fields) {
        const { actionType: _at, description: _d, category: _c, ...restFields } = node.fields;
        if (Object.keys(restFields).length > 0) {
          payload = restFields;
        }
      }

      return {
        type: actionType,
        payload,
        description: node.fields?.description as string | undefined,
        category: node.fields?.category as any,
      };
    }
  }

  return null;
}

/**
 * Extracts all TransitionActions and Claims from a root MeaningTree recursively.
 * Uses the single deterministic Runtime Projection for actions.
 */
export function extractActionsAndClaimsFromMeaningTree(root: MeaningNode): {
  actions: TransitionAction[];
  rawClaims: string[];
  intentSummary?: string;
} {
  assertValidMeaningTree(root);

  const projection = projectMeaningTreeToRuntimeActions(root);
  const rawClaims: string[] = [];
  let intentSummary: string | undefined;

  function traverse(current: MeaningNode) {
    if (current.atom === 'INTENT') {
      if (typeof current.value === 'string' && !intentSummary) {
        intentSummary = current.value;
      }
    }

    if (current.atom === 'CLAIM') {
      if (typeof current.value === 'string') {
        rawClaims.push(current.value);
      } else if (current.fields?.claimText && typeof current.fields.claimText === 'string') {
        rawClaims.push(current.fields.claimText);
      }
    }

    if (current.children && Array.isArray(current.children)) {
      for (const child of current.children) {
        traverse(child);
      }
    }
  }

  traverse(root);

  return { actions: [...projection.actions], rawClaims, intentSummary };
}

/**
 * MeaningTreeToProposalAdapter:
 * Converts a Meaning Tree into a strictly validated StateTransitionProposal.
 * The resulting proposal MUST then be submitted to SovereignEngine.submitProposal()
 * to undergo standard Validator, ImmigrationGate, and MutationBoundary checks.
 */
export function adaptMeaningTreeToProposal(
  root: MeaningNode,
  options: MeaningTreeProposalOptions
): StateTransitionProposal {
  assertValidMeaningTree(root);

  const { actions, rawClaims, intentSummary } = extractActionsAndClaimsFromMeaningTree(root);

  const proposalId = options.proposalId || `prop_lang_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const requestId = options.requestId || `req_${proposalId}`;
  const eventId = options.eventId || `evt_${proposalId}`;
  const timestamp = options.timestamp || new Date().toISOString();

  return {
    proposalId,
    requestId,
    eventId,
    expectedStateVersion: options.expectedStateVersion,
    source: options.source,
    turn: options.turn,
    timestamp,
    intentSummary: options.intentSummary || intentSummary,
    actions,
    rawClaims: rawClaims.length > 0 ? rawClaims : undefined,
    originInputId: options.originInputId,
    meaningTree: root,
  };
}

/**
 * TRPG 3.1 Sovereign Engine - Private Engine Capability Authority
 *
 * This module is strictly internal to the engine core (never exported publicly).
 * It uses a private WeakSet to authoritatively verify that a SYSTEM or ENGINE_INTERNAL
 * proposal was manufactured and dispatched directly by the Engine instance itself,
 * completely preventing external forgery, token theft, cloning, or parameter tampering.
 */

import {
  StateTransitionProposal,
  TransitionAction,
  CommitResult,
  ProposalSource
} from './types';
import type { SovereignEngine } from './state';
import { actionToMeaningNode } from './language/adapter';
import { MeaningNode } from './language/types';

const engineAuthorizedProposals = new WeakSet<object>();

/**
 * Validates whether a proposal is authenticated as genuine engine-internal.
 * Exclusively consumed by EngineValidator.
 */
export function isEngineAuthorized(proposal: object): boolean {
  return engineAuthorizedProposals.has(proposal);
}

export function authorizeEngineProposal(proposal: object): void {
  engineAuthorizedProposals.add(proposal);
}

/**
 * Authoritatively manufactures and dispatches an engine-internal SYSTEM or ENGINE_INTERNAL proposal.
 * This function is strictly private to the engine core and is NOT exposed on SovereignEngine instances.
 */
export function dispatchEngineInternalProposal(
  engine: SovereignEngine,
  params: {
    proposalId?: string;
    requestId?: string;
    eventId?: string;
    expectedStateVersion?: number;
    source?: ProposalSource;
    turn?: number;
    timestamp?: string;
    intentSummary?: string;
    actions: TransitionAction[];
    rawClaims?: string[];
    originInputId?: string;
  }
): CommitResult {
  const currentSnap = engine.getSnapshot();
  const rootMeaningNode: MeaningNode = {
    atom: 'INTENT',
    scope: 'PROPOSAL',
    value: params.intentSummary ?? 'Engine Internal Action',
    children: params.actions.map(act => actionToMeaningNode(act, 'PROPOSAL'))
  };

  const proposal: StateTransitionProposal = {
    proposalId: params.proposalId ?? `prop-int-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    requestId: params.requestId ?? `req-int-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    eventId: params.eventId ?? `evt-int-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    expectedStateVersion: params.expectedStateVersion ?? currentSnap.stateVersion,
    source: params.source ?? 'SYSTEM',
    turn: params.turn ?? currentSnap.turn,
    timestamp: params.timestamp ?? new Date().toISOString(),
    intentSummary: params.intentSummary ?? 'Engine Internal Action',
    actions: params.actions,
    rawClaims: params.rawClaims,
    originInputId: params.originInputId,
    meaningTree: rootMeaningNode
  };

  // Authoritatively register this genuine internal proposal in the private WeakSet
  engineAuthorizedProposals.add(proposal);

  // Submit through the standard Commit Gate
  return engine.submitProposal(proposal);
}

/**
 * Authoritatively manufactures and dispatches a single engine-internal action.
 */
export function dispatchEngineInternalAction(
  engine: SovereignEngine,
  actions: TransitionAction | TransitionAction[],
  intentSummary: string = 'Engine System Action'
): CommitResult {
  const actionList = Array.isArray(actions) ? actions : [actions];
  return dispatchEngineInternalProposal(engine, {
    intentSummary,
    actions: actionList,
    source: 'SYSTEM'
  });
}


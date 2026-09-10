import type { CanonicalState, ImmutableHistoricalRecord, TransitionAction } from '../types';
import type { NpcInformationTrace } from './npcInformationTypes';
import { admitNpcInformationCandidate } from './npcInformationCandidateGate';
import { attachNpcInformation } from './npcInformationAction';

export interface NpcInformationCandidateAdapterResult {
  readonly action: TransitionAction;
  readonly admitted: readonly NpcInformationTrace[];
  readonly rejected: readonly string[];
}

/**
 * Applies the existing information admission gate to candidate metadata and
 * attaches only admitted evidence to an existing canonical action.
 *
 * This is deliberately action-agnostic: it does not create a new ActionType,
 * mutate CanonicalState, or establish a new source of truth.
 */
export function adaptNpcInformationCandidateToAction(
  snapshot: CanonicalState,
  history: readonly ImmutableHistoricalRecord[],
  action: TransitionAction,
  candidateNpcId: string,
  information: NpcInformationTrace | readonly NpcInformationTrace[]
): NpcInformationCandidateAdapterResult {
  const admission = admitNpcInformationCandidate(snapshot, candidateNpcId, information, history);

  if (admission.admitted.length === 0) {
    return Object.freeze({
      action,
      admitted: Object.freeze([]),
      rejected: admission.rejected,
    });
  }

  return Object.freeze({
    action: attachNpcInformation(action, admission.admitted),
    admitted: admission.admitted,
    rejected: admission.rejected,
  });
}

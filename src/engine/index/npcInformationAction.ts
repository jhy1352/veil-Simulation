import type { TransitionAction } from '../types';
import type { NpcInformationTrace } from './npcInformationTypes';

/**
 * Adds history-carried NPC information evidence to an existing action without
 * introducing a new ActionType or mutating the canonical world directly.
 *
 * The metadata lives on the action payload and is therefore preserved by the
 * existing Sovereign Commit -> Immutable History canonicalAction path.
 */
export function attachNpcInformation(
  action: TransitionAction,
  information: NpcInformationTrace | readonly NpcInformationTrace[]
): TransitionAction {
  const traces = Array.isArray(information) ? [...information] : information;
  const payload = action.payload as Record<string, unknown>;
  return {
    ...action,
    payload: {
      ...payload,
      information: traces,
    },
  } as TransitionAction;
}

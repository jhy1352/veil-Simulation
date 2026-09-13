import { OffscreenWakeContext } from './offscreenHistoricalWake';

/**
 * Engine-side reasons that can make deferred history materially necessary.
 * Time passage and map discovery alone are deliberately non-wake triggers.
 */
export type WakeTrigger =
  | 'PLAYER_REENTERED_SCOPE'
  | 'ANCHOR_REVISITED'
  | 'CURRENT_STATE_REQUIRES_HISTORY'
  | 'NARRATIVE_DEPENDENCY'
  | 'TIME_ADVANCED'
  | 'MAP_DISCOVERED'
  | 'ALREADY_MATERIALIZED';

export interface WakeNecessityInput {
  readonly context: OffscreenWakeContext;
  readonly trigger: WakeTrigger;
  readonly alreadyMaterialized?: boolean;
}

export interface WakeNecessityResult {
  readonly shouldWake: boolean;
  readonly trigger: WakeTrigger;
  readonly reason: string;
}

/**
 * Determines whether deferred off-screen history must be materialized now.
 *
 * This function is intentionally pure and LLM-free. It does not generate,
 * mutate, commit, or otherwise establish world facts.
 */
export function evaluateWakeNecessity(input: WakeNecessityInput): WakeNecessityResult {
  const { context, trigger } = input;

  if (input.alreadyMaterialized || trigger === 'ALREADY_MATERIALIZED') {
    return Object.freeze({
      shouldWake: false,
      trigger,
      reason: 'Deferred history is already materialized for this scope.'
    });
  }

  if (context.elapsedTurns <= 0) {
    return Object.freeze({
      shouldWake: false,
      trigger,
      reason: 'No elapsed interval exists to materialize.'
    });
  }

  if (context.anchors.length === 0) {
    return Object.freeze({
      shouldWake: false,
      trigger,
      reason: 'No persistent anchor is available for deferred materialization.'
    });
  }

  switch (trigger) {
    case 'PLAYER_REENTERED_SCOPE':
    case 'ANCHOR_REVISITED':
    case 'CURRENT_STATE_REQUIRES_HISTORY':
    case 'NARRATIVE_DEPENDENCY':
      return Object.freeze({
        shouldWake: true,
        trigger,
        reason: 'Current player/world context requires deferred history to be materialized.'
      });

    case 'TIME_ADVANCED':
      return Object.freeze({
        shouldWake: false,
        trigger,
        reason: 'Time passage alone does not require LLM-backed historical materialization.'
      });

    case 'MAP_DISCOVERED':
      return Object.freeze({
        shouldWake: false,
        trigger,
        reason: 'Map discovery alone does not require historical materialization.'
      });
  }
}

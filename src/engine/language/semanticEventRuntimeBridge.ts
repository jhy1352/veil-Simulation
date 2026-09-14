/**
 * @file src/engine/language/semanticEventRuntimeBridge.ts
 * @description Explicit bridge contract from Causal Language SemanticEvents to
 * existing Sovereign runtime actions.
 *
 * This module is intentionally conservative. It does NOT invent canonical IDs,
 * world facts, inventory items, or provenance. Unsupported SemanticEvents are
 * returned as UNSUPPORTED instead of being guessed into TransitionActions.
 *
 * Authority order:
 * SemanticEvent -> bridge eligibility -> existing Sovereign Validator -> Commit
 *
 * SECURITY NOTE
 * ------------
 * `SemanticEvent.provenance` is LLM/frontend-controlled metadata and MUST NOT
 * become `verifiedEventId` directly. A trusted engine-side resolver must convert
 * an untrusted provenance reference into a currently valid verified event ID.
 */

import type { TransitionAction } from '../types';
import type { SemanticEvent, SemanticEventRole } from './types';

export type SemanticRuntimeBridgeStatus = 'MAPPABLE' | 'UNSUPPORTED' | 'INVALID';

export interface SemanticRuntimeBridgeResult {
  readonly status: SemanticRuntimeBridgeStatus;
  readonly actions: readonly TransitionAction[];
  readonly errors: readonly string[];
}

export interface SemanticRuntimeBridgeContext {
  /** Canonical player entity ID. Required when an event targets the player. */
  readonly playerId?: string;
  /** Canonical player display name, used only for recipient matching. */
  readonly playerName?: string;
  /** Resolve an already-canonical entity reference. This function must not create IDs. */
  readonly resolveCanonicalEntityId?: (role: SemanticEventRole) => string | undefined;
  /** Construct an already-resolved inventory item. The bridge never invents item IDs. */
  readonly resolveInventoryItem?: (role: SemanticEventRole) => {
    id: string;
    name: string;
    quantity: number;
    description?: string;
    category?: string;
    rarity?: string;
  } | undefined;
  /**
   * Resolve untrusted frontend provenance into a currently valid engine-owned
   * verified event ID. Returning undefined MUST fail closed.
   */
  readonly resolveVerifiedEventId?: (event: SemanticEvent) => string | undefined;
}

function findRole(event: SemanticEvent, role: SemanticEventRole['role']): SemanticEventRole | undefined {
  return event.roles.find((candidate) => candidate.role === role);
}

function isPlayerRole(role: SemanticEventRole | undefined, context: SemanticRuntimeBridgeContext): boolean {
  if (!role) return false;
  if (context.playerId && role.entityId === context.playerId) return true;
  if (context.playerName && role.entityName === context.playerName) return true;
  return role.entityName === '플레이어' || role.entityName === 'player';
}

function mapInventoryAcquisition(
  event: SemanticEvent,
  context: SemanticRuntimeBridgeContext
): SemanticRuntimeBridgeResult {
  const action = event.action.toUpperCase();
  const object = findRole(event, 'OBJECT');
  const recipient = findRole(event, 'RECIPIENT');
  const subject = findRole(event, 'SUBJECT');

  if (!object || !object.entityName) {
    return {
      status: 'INVALID',
      actions: [],
      errors: ['SemanticEvent inventory mapping requires a resolved OBJECT entity.'],
    };
  }

  // PICKUP always mutates the player inventory in the current Sovereign Action
  // model, so a non-player SUBJECT must never be projected into that action.
  if (action === 'PICKUP' && !isPlayerRole(subject, context)) {
    return {
      status: 'UNSUPPORTED',
      actions: [],
      errors: ['PICKUP currently maps only to player inventory; SUBJECT must resolve to the player.'],
    };
  }

  if (action === 'GIFT' && !isPlayerRole(recipient, context)) {
    return {
      status: 'UNSUPPORTED',
      actions: [],
      errors: ['GIFT currently has no Sovereign runtime action for non-player recipients.'],
    };
  }

  if (!context.resolveInventoryItem) {
    return {
      status: 'UNSUPPORTED',
      actions: [],
      errors: ['No canonical inventory-item resolver supplied; bridge will not invent an item ID.'],
    };
  }

  const item = context.resolveInventoryItem(object);
  if (!item) {
    return {
      status: 'UNSUPPORTED',
      actions: [],
      errors: [`OBJECT '${object.entityName}' is not canonically resolvable to an inventory item.`],
    };
  }

  const verifiedEventId = context.resolveVerifiedEventId?.(event);
  if (!verifiedEventId || !verifiedEventId.trim()) {
    return {
      status: 'UNSUPPORTED',
      actions: [],
      errors: [
        event.provenance
          ? 'SemanticEvent provenance is untrusted and could not be resolved by the Sovereign authority layer.'
          : 'SemanticEvent has no trusted verified-event resolution; narrative inventory acquisition is blocked.',
      ],
    };
  }

  const acquisitionCause = action === 'PICKUP' ? 'DISCOVERY_PICKUP' : 'GIFT';
  const sourceNpcId = subject ? context.resolveCanonicalEntityId?.(subject) : undefined;

  const actionResult: TransitionAction = {
    type: 'MODIFY_INVENTORY',
    payload: {
      item,
      operation: 'ADD',
      acquisition: {
        cause: acquisitionCause,
        verifiedEventId,
        sourceNpcId,
        causalSource: 'EXISTING_EVENT',
      },
    },
    description: `${event.action}: ${object.entityName}`,
    category: 'WORLD_CAUSAL',
  };

  return {
    status: 'MAPPABLE',
    actions: [actionResult],
    errors: [],
  };
}

/**
 * Translate one SemanticEvent only when the existing Sovereign Action model
 * can represent it without semantic invention or authority bypass.
 */
export function semanticEventToRuntimeActions(
  event: SemanticEvent,
  context: SemanticRuntimeBridgeContext = {}
): SemanticRuntimeBridgeResult {
  if (!event || typeof event.action !== 'string') {
    return {
      status: 'INVALID',
      actions: [],
      errors: ['SemanticEvent is missing a valid action.'],
    };
  }

  const action = event.action.toUpperCase();

  if (event.polarity === 'NEGATED' || event.modality === 'INTENTIONAL') {
    return {
      status: 'MAPPABLE',
      actions: [],
      errors: [],
    };
  }

  if (event.epistemicStatus === 'HEARSAY') {
    return {
      status: 'MAPPABLE',
      actions: [],
      errors: [],
    };
  }

  if (event.epistemicStatus === 'UNVERIFIED' || event.epistemicStatus === 'UNKNOWN') {
    return {
      status: 'UNSUPPORTED',
      actions: [],
      errors: [`${action} is non-canonical because epistemic status is ${event.epistemicStatus}.`],
    };
  }

  switch (action) {
    case 'PICKUP':
    case 'GIFT':
      return mapInventoryAcquisition(event, context);

    case 'QUERY':
      return {
        status: 'MAPPABLE',
        actions: [],
        errors: [],
      };

    default:
      return {
        status: 'UNSUPPORTED',
        actions: [],
        errors: [`Semantic action '${action}' has no explicit mapping to the current Sovereign ActionType.`],
      };
  }
}

/**
 * Translate a compiled SemanticEvent sequence conservatively.
 *
 * Unsupported events do not invalidate the other executable events in a
 * Candidate. They contribute no runtime actions and remain represented by the
 * CausalCompiler/MeaningTree. If the sequence contains only unsupported
 * executable events, the whole sequence remains UNSUPPORTED so canonical
 * mutation cannot be manufactured for an unmapped action or unresolved entity.
 * Invalid events still fail closed.
 */
export function semanticEventsToRuntimeActions(
  events: readonly SemanticEvent[],
  context: SemanticRuntimeBridgeContext = {}
): SemanticRuntimeBridgeResult {
  const actions: TransitionAction[] = [];
  const errors: string[] = [];
  let unsupportedCount = 0;

  for (const event of events) {
    const result = semanticEventToRuntimeActions(event, context);

    if (result.status === 'INVALID') {
      errors.push(...result.errors.map((error) => `[${event.eventId}] ${error}`));
      return {
        status: 'INVALID',
        actions: [],
        errors,
      };
    }

    if (result.status === 'UNSUPPORTED') {
      unsupportedCount += 1;
      errors.push(...result.errors.map((error) => `[${event.eventId}] ${error}`));
      continue;
    }

    actions.push(...result.actions);
  }

  if (unsupportedCount > 0 && actions.length === 0) {
    return {
      status: 'UNSUPPORTED',
      actions: [],
      errors,
    };
  }

  return {
    status: 'MAPPABLE',
    actions,
    errors,
  };
}

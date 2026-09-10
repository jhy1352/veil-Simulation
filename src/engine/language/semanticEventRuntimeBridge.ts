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
  const object = findRole(event, 'OBJECT');
  const recipient = findRole(event, 'RECIPIENT');

  if (!object || !object.entityName) {
    return {
      status: 'INVALID',
      actions: [],
      errors: ['SemanticEvent inventory mapping requires a resolved OBJECT entity.'],
    };
  }

  if (event.action.toUpperCase() === 'GIFT' && !isPlayerRole(recipient, context)) {
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

  const acquisitionCause = event.action.toUpperCase() === 'PICKUP' ? 'DISCOVERY_PICKUP' : 'GIFT';
  const sourceNpc = findRole(event, 'SUBJECT');
  const sourceNpcId = sourceNpc ? context.resolveCanonicalEntityId?.(sourceNpc) : undefined;

  const action: TransitionAction = {
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
    actions: [action],
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
      status: 'UNSUPPORTED',
      actions: [],
      errors: [`${action} is non-executable because polarity/modality does not assert a committed state change.`],
    };
  }

  if (event.epistemicStatus === 'HEARSAY' || event.epistemicStatus === 'UNVERIFIED' || event.epistemicStatus === 'UNKNOWN') {
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
 * Any unsupported/invalid event prevents partial silent projection.
 */
export function semanticEventsToRuntimeActions(
  events: readonly SemanticEvent[],
  context: SemanticRuntimeBridgeContext = {}
): SemanticRuntimeBridgeResult {
  const actions: TransitionAction[] = [];
  const errors: string[] = [];

  for (const event of events) {
    const result = semanticEventToRuntimeActions(event, context);
    if (result.status !== 'MAPPABLE') {
      errors.push(...result.errors.map((error) => `[${event.eventId}] ${error}`));
      return {
        status: result.status,
        actions: [],
        errors,
      };
    }
    actions.push(...result.actions);
  }

  return {
    status: 'MAPPABLE',
    actions,
    errors,
  };
}

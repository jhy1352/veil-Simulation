/**
 * @file src/engine/language/runtimeActionAdapter.ts
 * @description Dependency-free MeaningNode -> TransitionAction adapter.
 *
 * This module exists to keep the deterministic Runtime Projection independent
 * from the higher-level MeaningTree Proposal Adapter. It MUST remain a pure
 * projection helper: no canonical-state mutation, no authority escalation,
 * and no semantic inference.
 */

import type { ActionType, TransitionAction } from '../types';
import type { MeaningNode } from './types';
import { assertValidMeaningTree } from './grammar';

/**
 * Converts a validated MeaningNode into a standard VEIL TransitionAction if applicable.
 *
 * This handles legacy/runtime-native ACTION nodes that already carry an explicit
 * Sovereign ActionType. Compiler-produced SemanticEvents are handled by
 * semanticEventRuntimeBridge.ts in runtimeProjection.ts instead.
 */
export function meaningNodeToAction(node: MeaningNode, _context?: any): TransitionAction | null {
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

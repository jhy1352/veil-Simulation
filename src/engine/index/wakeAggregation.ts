import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { buildOffscreenWakeContext, OffscreenWakeContext } from './offscreenHistoricalWake';

/**
 * Engine-side aggregation for deferred off-screen materialization.
 *
 * Related anchors are grouped by structural co-occurrence in immutable
 * history. This prevents a single causal cluster from becoming one LLM call
 * per NPC/faction/item/event. Aggregation itself is deterministic and LLM-free.
 */
export interface WakeAggregationInput {
  readonly canonicalState: CanonicalState;
  readonly history: readonly ImmutableHistoricalRecord[];
  readonly fromTurn: number;
  readonly toTurn: number;
  readonly seedAnchorEntityIds: readonly string[];
}

export interface WakeAggregationResult {
  readonly anchorEntityIds: readonly string[];
  readonly context: OffscreenWakeContext;
}

function extractActionEntityIds(record: ImmutableHistoricalRecord): string[] {
  const payload: any = record.canonicalAction?.payload;
  if (!payload || typeof payload !== 'object') return [];

  const ids: string[] = [];
  if (typeof payload.id === 'string') ids.push(payload.id);
  if (typeof payload.factionId === 'string') ids.push(payload.factionId);
  if (typeof payload.item?.id === 'string') ids.push(payload.item.id);
  if (Array.isArray(payload.involvedNpcIds)) {
    for (const id of payload.involvedNpcIds) {
      if (typeof id === 'string') ids.push(id);
    }
  }
  if (typeof payload.acquisition?.sourceNpcId === 'string') {
    ids.push(payload.acquisition.sourceNpcId);
  }
  if (Array.isArray(payload.information)) {
    for (const trace of payload.information) {
      if (typeof trace?.recipientNpcId === 'string') ids.push(trace.recipientNpcId);
      if (typeof trace?.sourceNpcId === 'string') ids.push(trace.sourceNpcId);
    }
  } else if (payload.information && typeof payload.information === 'object') {
    if (typeof payload.information.recipientNpcId === 'string') ids.push(payload.information.recipientNpcId);
    if (typeof payload.information.sourceNpcId === 'string') ids.push(payload.information.sourceNpcId);
  }
  return ids;
}

function collectConnectedAnchorIds(
  history: readonly ImmutableHistoricalRecord[],
  fromTurn: number,
  toTurn: number,
  seedIds: readonly string[]
): string[] {
  const connected = new Set(seedIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()));
  if (!connected.size) return [];

  let changed = true;
  while (changed) {
    changed = false;
    for (const record of history) {
      if (record.turn < fromTurn || record.turn > toTurn) continue;
      const ids = [...new Set(extractActionEntityIds(record))];
      if (!ids.some(id => connected.has(id))) continue;
      for (const id of ids) {
        if (!connected.has(id)) {
          connected.add(id);
          changed = true;
        }
      }
    }
  }

  return [...connected];
}

/**
 * Expands a seed set into the smallest deterministic causal cluster visible
 * in the requested historical interval, then builds one wake context for it.
 */
export function aggregateOffscreenWake(input: WakeAggregationInput): WakeAggregationResult {
  const anchorEntityIds = collectConnectedAnchorIds(
    input.history,
    input.fromTurn,
    input.toTurn,
    input.seedAnchorEntityIds
  );

  const context = buildOffscreenWakeContext(
    input.canonicalState,
    input.history,
    input.fromTurn,
    input.toTurn,
    anchorEntityIds
  );

  return Object.freeze({
    anchorEntityIds: Object.freeze([...anchorEntityIds]),
    context
  });
}

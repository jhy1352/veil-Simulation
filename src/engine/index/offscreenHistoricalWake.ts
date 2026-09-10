import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { NpcRecord, NarrativeTime } from '../../types';

/**
 * Transient, read-only context for deferred off-screen world materialization.
 *
 * This is NOT a new source of truth. It is a compact view derived from
 * CanonicalState + immutable History so the Narrative Layer can reason about
 * what may have happened during an unseen interval.
 */
export interface OffscreenWakeAnchor {
  readonly entityId: string;
  readonly entityType: 'NPC' | 'FACTION' | 'ITEM' | 'OFFSCREEN_EVENT';
  readonly name: string;
  readonly currentLocation?: string;
  readonly currentStatus?: string;
  readonly lastHistoricalTurn?: number;
  readonly lastHistoricalRecordId?: string;
}

export interface OffscreenWakeContext {
  readonly fromTurn: number;
  readonly toTurn: number;
  readonly elapsedTurns: number;
  readonly currentNarrativeTime?: NarrativeTime;
  readonly anchors: readonly OffscreenWakeAnchor[];
  readonly relevantHistory: readonly ImmutableHistoricalRecord[];
  readonly generationPolicy: 'CAUSAL_SKELETON_ONLY';
  readonly authority: 'NON_CANONICAL_CONTEXT';
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
  return ids;
}

function recordTouchesAnchor(record: ImmutableHistoricalRecord, anchorId: string): boolean {
  return extractActionEntityIds(record).includes(anchorId);
}

function latestHistoryForAnchor(
  records: readonly ImmutableHistoricalRecord[],
  anchorId: string,
  maxTurn?: number
): ImmutableHistoricalRecord | undefined {
  let latest: ImmutableHistoricalRecord | undefined;
  for (const record of records) {
    if (maxTurn !== undefined && record.turn > maxTurn) continue;
    if (!recordTouchesAnchor(record, anchorId)) continue;
    if (!latest || record.turn > latest.turn) latest = record;
  }
  return latest;
}

function makeNpcAnchor(
  npc: NpcRecord,
  records: readonly ImmutableHistoricalRecord[],
  baselineTurn: number
): OffscreenWakeAnchor {
  const latest = latestHistoryForAnchor(records, npc.id, baselineTurn);
  return {
    entityId: npc.id,
    entityType: 'NPC',
    name: npc.name,
    currentLocation: npc.location,
    currentStatus: npc.status,
    lastHistoricalTurn: latest?.turn,
    lastHistoricalRecordId: latest?.recordId
  };
}

/**
 * Builds the minimum causal context required to wake an off-screen region or
 * entity after an elapsed interval.
 *
 * Important: this function does not simulate turns, invent events, mutate state,
 * or create Canonical History. The returned context is only input to a later
 * Narrative/LLM generation step; any generated wake must still pass the normal
 * Proposal -> PreAuth -> Sovereign Commit path.
 */
export function buildOffscreenWakeContext(
  canonicalState: CanonicalState,
  history: readonly ImmutableHistoricalRecord[],
  fromTurn: number,
  toTurn: number,
  anchorEntityIds: readonly string[] = []
): OffscreenWakeContext {
  if (!Number.isInteger(fromTurn) || !Number.isInteger(toTurn)) {
    throw new Error('[OFFSCREEN_WAKE_INVALID_INTERVAL] fromTurn and toTurn must be integers.');
  }
  if (toTurn < fromTurn) {
    throw new Error(`[OFFSCREEN_WAKE_INVALID_INTERVAL] toTurn (${toTurn}) cannot precede fromTurn (${fromTurn}).`);
  }
  if (canonicalState.turn < toTurn) {
    throw new Error(`[OFFSCREEN_WAKE_STATE_AHEAD] Canonical State turn ${canonicalState.turn} is behind requested wake turn ${toTurn}.`);
  }

  const requestedIds = new Set(anchorEntityIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()));
  const npcs = Array.isArray(canonicalState.worldInfo.npcs) ? canonicalState.worldInfo.npcs : [];
  const factions = Array.isArray(canonicalState.worldInfo.factions) ? canonicalState.worldInfo.factions : [];
  const inventory = Array.isArray(canonicalState.character.inventory) ? canonicalState.character.inventory : [];
  const offscreenRecords = Array.isArray(canonicalState.worldInfo.offscreenRecords)
    ? canonicalState.worldInfo.offscreenRecords
    : [];

  const anchors: OffscreenWakeAnchor[] = [];

  for (const npc of npcs) {
    if (!requestedIds.size || requestedIds.has(npc.id)) {
      anchors.push(makeNpcAnchor(npc, history, fromTurn));
    }
  }

  for (const faction of factions) {
    if (!requestedIds.size || requestedIds.has(faction.id)) {
      const latest = latestHistoryForAnchor(history, faction.id, fromTurn);
      anchors.push({
        entityId: faction.id,
        entityType: 'FACTION',
        name: faction.name,
        lastHistoricalTurn: latest?.turn,
        lastHistoricalRecordId: latest?.recordId
      });
    }
  }

  for (const item of inventory) {
    if (!requestedIds.size || requestedIds.has(item.id)) {
      const latest = latestHistoryForAnchor(history, item.id, fromTurn);
      anchors.push({
        entityId: item.id,
        entityType: 'ITEM',
        name: item.name,
        lastHistoricalTurn: latest?.turn,
        lastHistoricalRecordId: latest?.recordId
      });
    }
  }

  for (const event of offscreenRecords) {
    if (!requestedIds.size || requestedIds.has(event.id)) {
      const latest = latestHistoryForAnchor(history, event.id, fromTurn);
      anchors.push({
        entityId: event.id,
        entityType: 'OFFSCREEN_EVENT',
        name: event.eventDescription,
        lastHistoricalTurn: latest?.turn,
        lastHistoricalRecordId: latest?.recordId
      });
    }
  }

  const relevantHistory = history.filter(record => {
    if (record.turn < fromTurn || record.turn > toTurn) return false;
    if (!requestedIds.size) return true;
    return Array.from(requestedIds).some(id => recordTouchesAnchor(record, id));
  });

  return Object.freeze({
    fromTurn,
    toTurn,
    elapsedTurns: toTurn - fromTurn,
    currentNarrativeTime: canonicalState.worldInfo.currentTime,
    anchors: Object.freeze(anchors),
    relevantHistory: Object.freeze([...relevantHistory]),
    generationPolicy: 'CAUSAL_SKELETON_ONLY',
    authority: 'NON_CANONICAL_CONTEXT'
  });
}

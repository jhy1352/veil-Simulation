import { CanonicalState } from '../types';
import {
  CanonIndex,
  HistoricalIndex,
  RetrievalQuery,
  RetrievalResult,
  CanonIndexItem,
  HistoricalIndexItem
} from './types';

/**
 * Deep freezes an object or array to ensure strict read-only immutability.
 */
function freezeDeep<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      freezeDeep(val);
    }
  }
  return obj as Readonly<T>;
}

/**
 * Validates whether a given object is a valid, well-formed RetrievalResult with complete provenance.
 */
export function isValidRetrievalResult(result: any): result is RetrievalResult {
  if (!result || typeof result !== 'object') return false;
  if (result.authority !== 'NON_CANONICAL') return false;
  if (!result.sourceRecordId || typeof result.sourceRecordId !== 'string') return false;
  if (!result.sourceEventId || typeof result.sourceEventId !== 'string') return false;
  if (typeof result.sourceStateVersion !== 'number') return false;
  if (!result.sourceType || (result.sourceType !== 'INITIAL_CANON' && result.sourceType !== 'HISTORICAL')) return false;
  if (typeof result.isStaleRelativeToCanonical !== 'boolean') return false;
  return true;
}

/**
 * Determines whether a retrieved entity/item record is stale compared to current sovereign state.
 */
function evaluateStaleness(
  entityId: string | undefined,
  currentSnapshot: CanonicalState,
  actionDetails?: string
): { isStale: boolean; reason?: string } {
  if (!entityId || !currentSnapshot) {
    return { isStale: false };
  }

  // 1. Check NPC Staleness (e.g. Currently DEAD)
  const currentNpc = currentSnapshot.worldInfo.npcs?.find(n => n.id === entityId);
  if (currentNpc) {
    if (currentNpc.status === 'DEAD') {
      return {
        isStale: true,
        reason: `NPC '${currentNpc.name}' (${entityId}) is currently DEAD in Canonical State.`
      };
    }
  }

  // 2. Check Faction Staleness
  const currentFaction = currentSnapshot.worldInfo.factions?.find(f => f.id === entityId);
  // If faction ceased to exist or modified
  if (!currentNpc && !currentFaction) {
    // Check if it was an item
    const currentItem = currentSnapshot.character.inventory?.find(i => i.id === entityId);
    if (!currentItem && actionDetails && actionDetails.includes('item')) {
      return {
        isStale: true,
        reason: `Item (${entityId}) is no longer in Character Inventory in Canonical State.`
      };
    }
  }

  return { isStale: false };
}

/**
 * Pure Read-Only Retrieval Function.
 * Searches both Canon Index and Historical Index without any state-mutation capabilities.
 */
export function retrieveFromIndices(
  query: RetrievalQuery,
  canonIndex: CanonIndex,
  historicalIndex: HistoricalIndex,
  currentSnapshot: CanonicalState
): readonly RetrievalResult[] {
  const results: RetrievalResult[] = [];
  const includeCanon = query.includeCanon !== false;
  const includeHistory = query.includeHistory !== false;
  const queryLower = query.queryText ? query.queryText.toLowerCase().trim() : '';
  const maxLimit = query.limit && query.limit > 0 ? query.limit : 50;

  // -------------------------------------------------------------
  // 1. Search Initial Canon Index
  // -------------------------------------------------------------
  if (includeCanon && canonIndex && Array.isArray(canonIndex.items)) {
    for (const item of canonIndex.items) {
      if (results.length >= maxLimit) break;

      // Visibility filter
      if (query.visibilityFilter && query.visibilityFilter.length > 0) {
        if (!query.visibilityFilter.includes(item.visibility)) continue;
      }

      // Category filter
      if (query.category && item.category !== query.category) continue;

      // Entity ID filter
      if (query.entityId && item.entityId !== query.entityId) continue;

      // Text match filter
      let match = true;
      if (queryLower) {
        const textToSearch = `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
        match = textToSearch.includes(queryLower);
      }

      if (match) {
        const { isStale, reason } = evaluateStaleness(item.entityId, currentSnapshot, item.content);
        results.push({
          sourceType: 'INITIAL_CANON',
          content: item.content,
          sourceRecordId: item.id,
          sourceEventId: 'canon-initial-worldpack',
          sourceStateVersion: 1,
          entityId: item.entityId,
          authority: 'NON_CANONICAL',
          isStaleRelativeToCanonical: isStale,
          staleReason: reason
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 2. Search Historical Index
  // -------------------------------------------------------------
  if (includeHistory && historicalIndex && Array.isArray(historicalIndex.items)) {
    for (const item of historicalIndex.items) {
      if (results.length >= maxLimit) break;

      // Visibility filter
      if (query.visibilityFilter && query.visibilityFilter.length > 0) {
        if (!query.visibilityFilter.includes(item.informationAccess)) continue;
      }

      // Action Type filter
      if (query.actionType && item.actionType !== query.actionType) continue;

      // Entity ID filter
      if (query.entityId && item.entityId !== query.entityId) continue;

      // Text match filter
      let match = true;
      if (queryLower) {
        const textToSearch = `${item.summary} ${item.details} ${item.keywords.join(' ')}`.toLowerCase();
        match = textToSearch.includes(queryLower);
      }

      if (match) {
        const { isStale, reason } = evaluateStaleness(item.entityId, currentSnapshot, item.details);
        results.push({
          sourceType: 'HISTORICAL',
          content: item.summary,
          sourceRecordId: item.recordId,
          sourceEventId: item.eventId,
          sourceStateVersion: item.stateVersion,
          narrativeTime: item.narrativeTime,
          entityId: item.entityId,
          actionType: item.actionType,
          authority: 'NON_CANONICAL',
          isStaleRelativeToCanonical: isStale,
          staleReason: reason
        });
      }
    }
  }

  return freezeDeep(results);
}

/**
 * EngineRetriever class - A pure, read-only wrapper around the index & retrieval subsystem.
 * Strictly guarantees 0% mutation authority on CanonicalState and History.
 */
export class EngineRetriever {
  private canonIndex: CanonIndex;
  private historicalIndex: HistoricalIndex;

  constructor(canonIndex: CanonIndex, historicalIndex: HistoricalIndex) {
    this.canonIndex = canonIndex;
    this.historicalIndex = historicalIndex;
  }

  /**
   * Pure Read-Only Retrieval Query.
   */
  public query(query: RetrievalQuery, currentSnapshot: CanonicalState): readonly RetrievalResult[] {
    return retrieveFromIndices(query, this.canonIndex, this.historicalIndex, currentSnapshot);
  }

  /**
   * Clears internal index references without affecting any engine state.
   */
  public clear(): void {
    this.canonIndex = freezeDeep({
      items: [],
      byEntityId: new Map(),
      byTag: new Map(),
      totalItems: 0
    });
    this.historicalIndex = freezeDeep({
      items: [],
      byEntityId: new Map(),
      byActionType: new Map(),
      byKeyword: new Map(),
      totalRecords: 0
    });
  }

  /**
   * Accesses immutable snapshot of current indices.
   */
  public getIndices(): { readonly canonIndex: CanonIndex; readonly historicalIndex: HistoricalIndex } {
    return {
      canonIndex: this.canonIndex,
      historicalIndex: this.historicalIndex
    };
  }
}

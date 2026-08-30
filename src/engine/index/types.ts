import { ActionType, ImmutableHistoricalRecord, CanonicalState } from '../types';
import { NarrativeTime, WorldInfo } from '../../types';

export type RetrievalSourceType = 'INITIAL_CANON' | 'HISTORICAL';

export type CanonItemCategory =
  | 'WORLD_LORE'
  | 'NPC'
  | 'FACTION'
  | 'LOCATION'
  | 'TERMINOLOGY'
  | 'RUMOR';

export interface CanonIndexItem {
  readonly id: string;
  readonly category: CanonItemCategory;
  readonly title: string;
  readonly content: string;
  readonly entityId?: string;
  readonly tags: readonly string[];
  readonly visibility: 'PUBLIC' | 'FACTION_ONLY' | 'PRIVATE' | 'HIDDEN';
}

export interface CanonIndex {
  readonly items: readonly CanonIndexItem[];
  readonly byEntityId: ReadonlyMap<string, readonly CanonIndexItem[]>;
  readonly byTag: ReadonlyMap<string, readonly CanonIndexItem[]>;
  readonly totalItems: number;
}

export interface HistoricalIndexItem {
  readonly recordId: string;
  readonly eventId: string;
  readonly stateVersion: number;
  readonly turn: number;
  readonly timestamp: string;
  readonly narrativeTime?: NarrativeTime;
  readonly actionType: ActionType;
  readonly entityId?: string;
  readonly keywords: readonly string[];
  readonly summary: string;
  readonly details: string;
  readonly informationAccess: 'PUBLIC' | 'FACTION_ONLY' | 'PRIVATE' | 'HIDDEN' | 'RUMOR';
}

export interface HistoricalIndex {
  readonly items: readonly HistoricalIndexItem[];
  readonly byEntityId: ReadonlyMap<string, readonly HistoricalIndexItem[]>;
  readonly byActionType: ReadonlyMap<ActionType, readonly HistoricalIndexItem[]>;
  readonly byKeyword: ReadonlyMap<string, readonly HistoricalIndexItem[]>;
  readonly totalRecords: number;
}

export interface RetrievalResult {
  readonly sourceType: RetrievalSourceType;
  readonly content: string;
  readonly sourceRecordId: string;
  readonly sourceEventId: string;
  readonly sourceStateVersion: number;
  readonly narrativeTime?: NarrativeTime;
  readonly entityId?: string;
  readonly actionType?: ActionType;
  readonly authority: 'NON_CANONICAL';
  readonly isStaleRelativeToCanonical: boolean;
  readonly staleReason?: string;
}

export interface RetrievalQuery {
  readonly queryText?: string;
  readonly entityId?: string;
  readonly category?: CanonItemCategory;
  readonly actionType?: ActionType;
  readonly limit?: number;
  readonly includeCanon?: boolean;
  readonly includeHistory?: boolean;
  readonly visibilityFilter?: readonly ('PUBLIC' | 'FACTION_ONLY' | 'PRIVATE' | 'HIDDEN' | 'RUMOR')[];
}

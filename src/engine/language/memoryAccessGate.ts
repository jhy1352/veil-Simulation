/**
 * VEIL Memory Access Gate
 *
 * Read-only boundary between LLM memory requests and the engine's
 * canonical/historical retrieval subsystem.
 *
 * The LLM never receives direct access to History, indices, or the
 * Knowledge Graph. Natural-language requests must be normalized by the
 * caller into this constrained query shape before retrieval occurs.
 */

import { CanonicalState } from '../types';
import { CanonIndex, HistoricalIndex, RetrievalResult, RetrievalQuery } from '../index/types';
import { retrieveFromIndices } from '../index/retriever';

export interface MemoryAccessQuery {
  readonly queryText?: string;
  readonly entityId?: string;
  readonly category?: RetrievalQuery['category'];
  readonly actionType?: RetrievalQuery['actionType'];
  readonly limit?: number;
  readonly includeCanon?: boolean;
  readonly includeHistory?: boolean;
}

export interface MemoryAccessResult {
  readonly results: readonly RetrievalResult[];
  readonly granted: boolean;
  readonly reason?: string;
}

const MAX_MEMORY_RESULTS = 20;

function normalizeQuery(query: MemoryAccessQuery): RetrievalQuery {
  const queryText = typeof query.queryText === 'string' ? query.queryText.trim() : undefined;
  const entityId = typeof query.entityId === 'string' ? query.entityId.trim() : undefined;
  const limit = Number.isInteger(query.limit) && (query.limit as number) > 0
    ? Math.min(query.limit as number, MAX_MEMORY_RESULTS)
    : MAX_MEMORY_RESULTS;

  return {
    queryText,
    entityId: entityId || undefined,
    category: query.category,
    actionType: query.actionType,
    limit,
    includeCanon: query.includeCanon !== false,
    includeHistory: query.includeHistory !== false,
    // Visibility is intentionally NOT supplied by the LLM.
    // Access policy belongs to the Recovery boundary.
    visibilityFilter: ['PUBLIC', 'RUMOR']
  };
}

/**
 * Strict read-only memory access controlled by the Recovery boundary.
 * No canonical state, history, or index mutation is possible here.
 */
export function readWorldMemory(
  query: MemoryAccessQuery,
  canonIndex: CanonIndex,
  historicalIndex: HistoricalIndex,
  currentSnapshot: CanonicalState
): MemoryAccessResult {
  if (!query || typeof query !== 'object') {
    return { granted: false, results: [], reason: 'Invalid memory query.' };
  }

  const normalized = normalizeQuery(query);
  const results = retrieveFromIndices(normalized, canonIndex, historicalIndex, currentSnapshot);

  return {
    granted: true,
    results
  };
}

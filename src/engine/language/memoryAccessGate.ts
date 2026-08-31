/**
 * VEIL Memory Access Gate
 *
 * Read-only boundary between LLM memory requests and the engine's
 * canonical/historical retrieval subsystem.
 *
 * The LLM never receives direct access to History, indices, or the
 * Knowledge Graph. Access scope is supplied by an engine-owned policy,
 * never by the LLM request itself.
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

export interface MemoryAccessPolicy {
  /** Engine-owned visibility scope. The LLM cannot supply or widen this. */
  readonly allowedVisibility: readonly ('PUBLIC' | 'FACTION_ONLY' | 'PRIVATE' | 'HIDDEN' | 'RUMOR')[];
  readonly maxResults?: number;
}

export interface MemoryAccessResult {
  readonly results: readonly RetrievalResult[];
  readonly granted: boolean;
  readonly reason?: string;
}

const DEFAULT_MAX_MEMORY_RESULTS = 20;
const DEFAULT_POLICY: MemoryAccessPolicy = {
  allowedVisibility: ['PUBLIC', 'RUMOR'],
  maxResults: DEFAULT_MAX_MEMORY_RESULTS
};

function normalizeQuery(query: MemoryAccessQuery, policy: MemoryAccessPolicy): RetrievalQuery {
  const queryText = typeof query.queryText === 'string' ? query.queryText.trim() : undefined;
  const entityId = typeof query.entityId === 'string' ? query.entityId.trim() : undefined;
  const requestedLimit = Number.isInteger(query.limit) && (query.limit as number) > 0
    ? query.limit as number
    : DEFAULT_MAX_MEMORY_RESULTS;
  const policyLimit = Number.isInteger(policy.maxResults) && (policy.maxResults as number) > 0
    ? policy.maxResults as number
    : DEFAULT_MAX_MEMORY_RESULTS;

  return {
    queryText,
    entityId: entityId || undefined,
    category: query.category,
    actionType: query.actionType,
    limit: Math.min(requestedLimit, policyLimit),
    includeCanon: query.includeCanon !== false,
    includeHistory: query.includeHistory !== false,
    // Critical boundary: visibility comes exclusively from engine policy.
    visibilityFilter: [...policy.allowedVisibility]
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
  currentSnapshot: CanonicalState,
  policy: MemoryAccessPolicy = DEFAULT_POLICY
): MemoryAccessResult {
  if (!query || typeof query !== 'object') {
    return { granted: false, results: [], reason: 'Invalid memory query.' };
  }

  if (!policy || !Array.isArray(policy.allowedVisibility) || policy.allowedVisibility.length === 0) {
    return { granted: false, results: [], reason: 'No engine-owned memory access scope is available.' };
  }

  const normalized = normalizeQuery(query, policy);
  const results = retrieveFromIndices(normalized, canonIndex, historicalIndex, currentSnapshot);

  return { granted: true, results };
}

import { CandidatePacket, InventoryItem } from '../../types';
import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { buildKnowledgeGraph, UniversalEntity } from './knowledgeGraph';

/**
 * Deterministic identity resolution result.
 *
 * The resolver is evidence infrastructure only. It NEVER mutates CanonicalState
 * and NEVER allocates a canonical identifier.
 */
export type EntityIdentityStatus = 'EXACT' | 'RECOVERED' | 'NOVEL' | 'AMBIGUOUS' | 'CONFLICT';

export interface EntityIdentityCandidate {
  readonly entityId: string;
  readonly entity: UniversalEntity;
  readonly matchBasis: readonly string[];
}

export interface EntityIdentityResolution {
  readonly status: EntityIdentityStatus;
  readonly canonicalId?: string;
  readonly candidates: readonly EntityIdentityCandidate[];
  readonly normalizedName: string;
  readonly reason: string;
}

function normalizeIdentityText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ');
}

function isCurrentInventoryItem(currentState: CanonicalState, entityId: string): boolean {
  return currentState.character.inventory.some(item => item.id === entityId && item.quantity > 0);
}

/**
 * Resolves an inventory item mention against the current Canonical State and
 * the read-only Universal Knowledge Graph derived from canonical/history data.
 *
 * Resolution policy:
 * 1. One current canonical item with an exact normalized name => EXACT.
 * 2. One historical/derived item with an exact normalized name => RECOVERED.
 * 3. Multiple distinct entity IDs with the same name => AMBIGUOUS.
 * 4. No matching entity => NOVEL (candidate only; the Engine may allocate a new ID later).
 *
 * Crucially, a failed lookup is NOT itself proof that an item is new once the
 * graph is available; ambiguity never falls through to new-entity creation.
 */
export function resolveInventoryItemIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  name: string
): EntityIdentityResolution {
  const normalizedName = normalizeIdentityText(name);

  if (!normalizedName) {
    return {
      status: 'CONFLICT',
      candidates: [],
      normalizedName,
      reason: 'Inventory item identity cannot be resolved from an empty name.'
    };
  }

  const graph = buildKnowledgeGraph(currentState, historicalRecords);
  const matches: EntityIdentityCandidate[] = [];

  for (const entity of graph.entities.values()) {
    if (entity.entityType !== 'ITEM') continue;
    if (normalizeIdentityText(entity.name) !== normalizedName) continue;

    const current = isCurrentInventoryItem(currentState, entity.entityId);
    matches.push({
      entityId: entity.entityId,
      entity,
      matchBasis: [current ? 'CURRENT_CANONICAL_INVENTORY' : 'HISTORICAL_OR_DERIVED_IDENTITY', 'EXACT_NORMALIZED_NAME']
    });
  }

  if (matches.length === 1) {
    const match = matches[0];
    const current = isCurrentInventoryItem(currentState, match.entityId);
    return {
      status: current ? 'EXACT' : 'RECOVERED',
      canonicalId: match.entityId,
      candidates: matches,
      normalizedName,
      reason: current
        ? `Exact canonical inventory identity resolved to '${match.entityId}'.`
        : `Historical/derived evidence uniquely recovered canonical item identity '${match.entityId}'.`
    };
  }

  if (matches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      candidates: matches,
      normalizedName,
      reason: `Multiple distinct canonical item identities match '${name}'. New identity allocation is prohibited.`
    };
  }

  return {
    status: 'NOVEL',
    candidates: [],
    normalizedName,
    reason: `No existing canonical or historical item identity matches '${name}'.`
  };
}

/**
 * Convenience resolver for CandidatePacket inventory entries.
 * Kept separate from proposal construction so the same identity service can
 * later be reused by NPC, faction, event, and location resolution.
 */
export function resolveCandidateInventoryIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  inventoryCandidate: CandidatePacket['inventoryChanges'][number]
): EntityIdentityResolution {
  return resolveInventoryItemIdentity(currentState, historicalRecords, inventoryCandidate.name);
}

/**
 * Narrows a resolution to an existing InventoryItem when the resolved ID is
 * currently owned. Useful for REMOVE operations without allowing name-based
 * fallback to silently select another entity.
 */
export function getResolvedCurrentInventoryItem(
  currentState: CanonicalState,
  resolution: EntityIdentityResolution
): InventoryItem | undefined {
  if (!resolution.canonicalId) return undefined;
  return currentState.character.inventory.find(item => item.id === resolution.canonicalId && item.quantity > 0);
}

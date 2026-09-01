import { CandidatePacket, EntityReferenceBundle } from '../../types';
import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { buildKnowledgeGraph, UniversalEntity, UniversalKnowledgeGraph } from './knowledgeGraph';

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
  return value.trim().toLocaleLowerCase().normalize('NFKC').replace(/\s+/g, ' ');
}

function containsEvidence(text: string, value?: string): boolean {
  return !!value && text.includes(value);
}

function isCurrentInventoryItem(state: CanonicalState, entityId: string): boolean {
  return state.character.inventory.some(item => item.id === entityId && item.quantity > 0);
}

/**
 * Deterministic inventory identity resolver.
 * The LLM supplied ID is a claim; CanonicalState and historical evidence remain authoritative.
 *
 * A prebuilt request-scoped graph may be supplied so multiple candidates do not rebuild
 * the same read-only Knowledge Graph repeatedly.
 */
export function resolveInventoryItemIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  name: string,
  reference: EntityReferenceBundle,
  graph?: UniversalKnowledgeGraph
): EntityIdentityResolution {
  const normalizedName = normalizeIdentityText(name);
  if (!normalizedName || reference.entityType !== 'ITEM') {
    return { status: 'CONFLICT', candidates: [], normalizedName, reason: 'Inventory identity bundle is structurally invalid.' };
  }

  const resolvedGraph = graph || buildKnowledgeGraph(currentState, historicalRecords);
  const allItems = Array.from(resolvedGraph.entities.values()).filter(e => e.entityType === 'ITEM');
  const nameMatches = allItems.filter(e => normalizeIdentityText(e.name) === normalizedName);

  if (reference.claimedEntityId) {
    const claimed = resolvedGraph.entities.get(reference.claimedEntityId);
    if (!claimed || claimed.entityType !== 'ITEM') {
      return {
        status: 'CONFLICT',
        candidates: nameMatches.map(entity => ({ entityId: entity.entityId, entity, matchBasis: ['EXACT_NORMALIZED_NAME'] })),
        normalizedName,
        reason: `Claimed entity ID '${reference.claimedEntityId}' does not resolve to an ITEM in Engine indices.`
      };
    }
    if (normalizeIdentityText(claimed.name) !== normalizedName) {
      return {
        status: 'CONFLICT',
        candidates: [{ entityId: claimed.entityId, entity: claimed, matchBasis: ['CLAIMED_ID'] }],
        normalizedName,
        reason: `Claimed entity ID '${reference.claimedEntityId}' resolves to '${claimed.name}', not '${name}'.`
      };
    }

    const evidenceHits: string[] = ['CLAIMED_ID', 'EXACT_NORMALIZED_NAME'];
    if (isCurrentInventoryItem(currentState, claimed.entityId)) evidenceHits.push('CURRENT_CANONICAL_INVENTORY');

    for (const rec of historicalRecords) {
      if (reference.evidence.verifiedEventId && rec.eventId === reference.evidence.verifiedEventId) evidenceHits.push('VERIFIED_EVENT_ID');
      if (reference.evidence.sourceNpcId && containsEvidence(rec.details, reference.evidence.sourceNpcId)) evidenceHits.push('SOURCE_NPC_ID');
      if (containsEvidence(rec.details, claimed.entityId)) evidenceHits.push('HISTORICAL_ENTITY_ID');
    }

    return {
      status: 'EXACT',
      canonicalId: claimed.entityId,
      candidates: [{ entityId: claimed.entityId, entity: claimed, matchBasis: evidenceHits }],
      normalizedName,
      reason: `Claimed ID '${claimed.entityId}' agrees with the canonical item name and was cross-checked against available evidence.`
    };
  }

  if (nameMatches.length === 1) {
    const match = nameMatches[0];
    const basis = ['EXACT_NORMALIZED_NAME'];
    if (isCurrentInventoryItem(currentState, match.entityId)) basis.push('CURRENT_CANONICAL_INVENTORY');
    for (const rec of historicalRecords) {
      if (reference.evidence.verifiedEventId && rec.eventId === reference.evidence.verifiedEventId) basis.push('VERIFIED_EVENT_ID');
      if (reference.evidence.sourceNpcId && containsEvidence(rec.details, reference.evidence.sourceNpcId)) basis.push('SOURCE_NPC_ID');
      if (containsEvidence(rec.details, match.entityId)) basis.push('HISTORICAL_ENTITY_ID');
    }
    return {
      status: 'RECOVERED',
      canonicalId: match.entityId,
      candidates: [{ entityId: match.entityId, entity: match, matchBasis: basis }],
      normalizedName,
      reason: 'Canonical item identity was recovered without relying on an LLM-supplied ID.'
    };
  }

  if (nameMatches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      candidates: nameMatches.map(entity => ({ entityId: entity.entityId, entity, matchBasis: ['EXACT_NORMALIZED_NAME'] })),
      normalizedName,
      reason: `Multiple distinct ITEM identities match '${name}'. New identity allocation is prohibited.`
    };
  }

  return {
    status: 'NOVEL',
    candidates: [],
    normalizedName,
    reason: `No existing canonical or historical ITEM identity matches '${name}'. The Engine may allocate a new identity only after normal causality validation.`
  };
}

export function resolveCandidateInventoryIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  inventoryCandidate: NonNullable<CandidatePacket['inventoryChanges']>[number],
  graph?: UniversalKnowledgeGraph
): EntityIdentityResolution {
  return resolveInventoryItemIdentity(currentState, historicalRecords, inventoryCandidate.name, inventoryCandidate.entityReference, graph);
}

export function getResolvedCurrentInventoryItem(
  currentState: CanonicalState,
  resolution: EntityIdentityResolution
) {
  if (!resolution.canonicalId) return undefined;
  return currentState.character.inventory.find(item => item.id === resolution.canonicalId && item.quantity > 0);
}

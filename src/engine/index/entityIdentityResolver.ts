/**
 * @file src/engine/index/entityIdentityResolver.ts
 * @description Canonical Entity Identity Resolver for Sovereign Engine.
 *
 * Core Invariants & Sovereignty Principles:
 * 1. LLM Claim Isolation: claimedEntityId from LLM is a claim/evidence only, NEVER an authority.
 * 2. Deterministic Verification: Resolutions are grounded strictly in CanonicalState and ImmutableHistoricalRecord graphs.
 * 3. Index Miss ≠ NOVEL: An entity not found in the graph is NOT automatically NOVEL.
 *    NOVEL status is granted ONLY when positive novelty/acquisition/creation evidence is present.
 * 4. Engine-Only ID Issuance: Resolver NEVER issues new canonical IDs or mutates state. New ID allocation is performed
 *    strictly at the Engine / Proposal mutation boundary.
 * 5. Fail-Closed on Uncertainty: AMBIGUOUS and CONFLICT states prohibit canonical mutations.
 */

import { CandidatePacket, EntityReferenceBundle, CanonicalEntityReferenceType } from '../../types';
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

export function normalizeIdentityText(value: string): string {
  return value.trim().toLocaleLowerCase().normalize('NFKC').replace(/\s+/g, ' ');
}

function containsEvidence(text: string, value?: string): boolean {
  return !!value && text.includes(value);
}

function isCurrentInventoryItem(state: CanonicalState, entityId: string): boolean {
  return state.character.inventory.some(item => item.id === entityId && item.quantity > 0);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const VALID_NOVELTY_CAUSES = new Set([
  'RESOURCE_EXCHANGE',
  'DISCOVERY_PICKUP',
  'DISCOVERY',
  'GIFT_REWARD',
  'GIFT',
  'REWARD',
  'LOOT',
  'PURCHASE',
  'CRAFTING',
  'ENCOUNTER',
  'FIRST_ENCOUNTER',
  'EAVESDROP',
  'CREATION',
  'GENESIS_STARTER',
  'SYSTEM_INITIALIZATION'
]);

/**
 * Validates whether the provided reference bundle contains positive novelty/acquisition evidence
 * grounded in Canonical State and History to justify classifying an unknown entity as NOVEL.
 * 
 * Strict Invariant:
 * "verifiedEventId" and "sourceNpcId" are not trusted as raw strings; they MUST resolve
 * against actual CanonicalState or ImmutableHistoricalRecord indices.
 */
export function hasPositiveNoveltyEvidence(
  reference?: EntityReferenceBundle,
  currentState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  graph?: UniversalKnowledgeGraph
): boolean {
  if (!reference || !reference.evidence) return false;
  const ev = reference.evidence;

  // 1. Verified Event ID: if claimed, it MUST actually exist in historical records, offscreen records, or lastCommittedEventId
  if (isNonEmptyString(ev.verifiedEventId)) {
    const verifiedInHistory = historicalRecords.some(r => r.eventId === ev.verifiedEventId);
    const verifiedInOffscreen = (currentState?.worldInfo?.offscreenRecords || []).some(o => o.id === ev.verifiedEventId);
    const verifiedInLastCommit = currentState?.lastCommittedEventId === ev.verifiedEventId;
    if (!verifiedInHistory && !verifiedInOffscreen && !verifiedInLastCommit) {
      return false;
    }
    return true;
  }

  // 2. Source NPC ID: if claimed, it MUST actually exist in canonical NPCs or Knowledge Graph
  if (isNonEmptyString(ev.sourceNpcId)) {
    const inCanonicalNpcs = (currentState?.worldInfo?.npcs || []).some(n => n.id === ev.sourceNpcId);
    if (inCanonicalNpcs) return true;
    if (graph) {
      const entity = graph.entities.get(ev.sourceNpcId);
      if (entity && entity.entityType === 'NPC') return true;
    } else if (currentState) {
      const tempGraph = buildKnowledgeGraph(currentState, historicalRecords);
      const entity = tempGraph.entities.get(ev.sourceNpcId);
      if (entity && entity.entityType === 'NPC') return true;
    }
    return false;
  }

  // 3. Positive Acquisition/Creation Cause
  if (isNonEmptyString(ev.cause)) {
    return true;
  }

  // 4. Concrete Cost transaction
  if (ev.cost && typeof ev.cost === 'object' && (isNonEmptyString(ev.cost.name) || isNonEmptyString(ev.cost.id) || (typeof ev.cost.quantity === 'number' && ev.cost.quantity > 0))) {
    return true;
  }

  // 5. Causal Context description
  if (isNonEmptyString(ev.context) && ev.context.trim().length >= 3) {
    return true;
  }

  return false;
}

/**
 * Builds a request-scoped Read-Only Universal Knowledge Graph once per proposal.
 */
export function buildInventoryIdentityGraph(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = []
): UniversalKnowledgeGraph {
  return buildKnowledgeGraph(currentState, historicalRecords);
}

/**
 * Universal deterministic entity identity resolver.
 * Handles CHARACTER, NPC, FACTION, ITEM, and NARRATIVE_SEED types.
 */
export function resolveEntityIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  entityType: CanonicalEntityReferenceType,
  name: string,
  reference?: EntityReferenceBundle,
  graph?: UniversalKnowledgeGraph
): EntityIdentityResolution {
  const normalizedName = normalizeIdentityText(name);
  if (!normalizedName) {
    return {
      status: 'CONFLICT',
      candidates: [],
      normalizedName: '',
      reason: 'Entity name is empty or invalid.'
    };
  }

  const resolvedGraph = graph || buildKnowledgeGraph(currentState, historicalRecords);
  const matchingTypeEntities = Array.from(resolvedGraph.entities.values()).filter(e => e.entityType === entityType);
  const nameMatches = matchingTypeEntities.filter(e => {
    if (normalizeIdentityText(e.name) === normalizedName || normalizeIdentityText(e.entityId) === normalizedName) {
      return true;
    }
    if (e.aliases && e.aliases.some(a => normalizeIdentityText(a) === normalizedName)) {
      return true;
    }
    return false;
  });

  // Case 1: LLM provided a claimedEntityId
  if (reference?.claimedEntityId && isNonEmptyString(reference.claimedEntityId)) {
    const claimedId = reference.claimedEntityId.trim();
    const claimedEntity = resolvedGraph.entities.get(claimedId);

    if (!claimedEntity || claimedEntity.entityType !== entityType) {
      return {
        status: 'CONFLICT',
        candidates: nameMatches.map(entity => ({ entityId: entity.entityId, entity, matchBasis: ['EXACT_NORMALIZED_NAME'] })),
        normalizedName,
        reason: `Claimed entity ID '${claimedId}' does not resolve to a canonical ${entityType} in Engine indices.`
      };
    }

    const claimedEntityNormName = normalizeIdentityText(claimedEntity.name);
    const claimedEntityNormId = normalizeIdentityText(claimedEntity.entityId);
    const claimedEntityAliasMatches = claimedEntity.aliases && claimedEntity.aliases.some(a => normalizeIdentityText(a) === normalizedName);
    if (claimedEntityNormName !== normalizedName && claimedEntityNormId !== normalizedName && !claimedEntityAliasMatches) {
      return {
        status: 'CONFLICT',
        candidates: [{ entityId: claimedEntity.entityId, entity: claimedEntity, matchBasis: ['CLAIMED_ID'] }],
        normalizedName,
        reason: `Claimed entity ID '${claimedId}' resolves to '${claimedEntity.name}', which does not match requested '${name}'.`
      };
    }

    const evidenceHits: string[] = ['CLAIMED_ID', 'EXACT_NORMALIZED_NAME'];
    if (entityType === 'ITEM' && isCurrentInventoryItem(currentState, claimedEntity.entityId)) {
      evidenceHits.push('CURRENT_CANONICAL_INVENTORY');
    }
    for (const rec of historicalRecords) {
      if (reference.evidence?.verifiedEventId && rec.eventId === reference.evidence.verifiedEventId) {
        evidenceHits.push('VERIFIED_EVENT_ID');
      }
      if (reference.evidence?.sourceNpcId && containsEvidence(rec.details, reference.evidence.sourceNpcId)) {
        evidenceHits.push('SOURCE_NPC_ID');
      }
      if (containsEvidence(rec.details, claimedEntity.entityId)) {
        evidenceHits.push('HISTORICAL_ENTITY_ID');
      }
    }

    return {
      status: 'EXACT',
      canonicalId: claimedEntity.entityId,
      candidates: [{ entityId: claimedEntity.entityId, entity: claimedEntity, matchBasis: evidenceHits }],
      normalizedName,
      reason: `Claimed ID '${claimedEntity.entityId}' agrees with canonical ${entityType} name and was cross-checked against indices.`
    };
  }

  // Case 2: No claimed ID, exactly 1 unique name match in existing indices
  if (nameMatches.length === 1) {
    const match = nameMatches[0];
    const basis = ['EXACT_NORMALIZED_NAME'];
    if (entityType === 'ITEM' && isCurrentInventoryItem(currentState, match.entityId)) {
      basis.push('CURRENT_CANONICAL_INVENTORY');
    }
    for (const rec of historicalRecords) {
      if (reference?.evidence?.verifiedEventId && rec.eventId === reference.evidence.verifiedEventId) {
        basis.push('VERIFIED_EVENT_ID');
      }
      if (reference?.evidence?.sourceNpcId && containsEvidence(rec.details, reference.evidence.sourceNpcId)) {
        basis.push('SOURCE_NPC_ID');
      }
      if (containsEvidence(rec.details, match.entityId)) {
        basis.push('HISTORICAL_ENTITY_ID');
      }
    }

    return {
      status: 'RECOVERED',
      canonicalId: match.entityId,
      candidates: [{ entityId: match.entityId, entity: match, matchBasis: basis }],
      normalizedName,
      reason: `Canonical ${entityType} identity was recovered uniquely from existing indices without relying on an LLM ID.`
    };
  }

  // Case 3: Multiple matching identities (Homonym / duplicate names)
  if (nameMatches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      candidates: nameMatches.map(entity => ({ entityId: entity.entityId, entity, matchBasis: ['EXACT_NORMALIZED_NAME'] })),
      normalizedName,
      reason: `Multiple distinct ${entityType} identities match '${name}'. Identity is ambiguous; mutation is prohibited.`
    };
  }

  // Case 4: No matching entity in graph (Index Miss)
  // Strict Invariant: Index miss ≠ NOVEL. Positive novelty/acquisition evidence is required.
  if (hasPositiveNoveltyEvidence(reference, currentState, historicalRecords, resolvedGraph)) {
    return {
      status: 'NOVEL',
      candidates: [],
      normalizedName,
      reason: `No existing canonical or historical ${entityType} identity matches '${name}', but positive acquisition/novelty evidence was verified. New ID may be allocated by Engine authority.`
    };
  }

  // Index miss without novelty evidence -> AMBIGUOUS (Mutation prohibited)
  return {
    status: 'AMBIGUOUS',
    candidates: [],
    normalizedName,
    reason: `Index miss: No existing ${entityType} matches '${name}', and positive novelty/acquisition evidence is absent or ungrounded. Mutation is prohibited.`
  };
}

/**
 * Deterministic NPC identity resolver.
 */
export function resolveNpcIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  name: string,
  reference?: EntityReferenceBundle,
  graph?: UniversalKnowledgeGraph
): EntityIdentityResolution {
  if (reference && reference.entityType !== 'NPC') {
    return {
      status: 'CONFLICT',
      candidates: [],
      normalizedName: normalizeIdentityText(name),
      reason: `Expected entityType 'NPC' for NPC resolution, got '${reference.entityType}'.`
    };
  }

  return resolveEntityIdentity(currentState, historicalRecords, 'NPC', name, reference, graph);
}

/**
 * Deterministic Faction identity resolver.
 */
export function resolveFactionIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  name: string,
  reference?: EntityReferenceBundle,
  graph?: UniversalKnowledgeGraph
): EntityIdentityResolution {
  if (reference && reference.entityType !== 'FACTION') {
    return {
      status: 'CONFLICT',
      candidates: [],
      normalizedName: normalizeIdentityText(name),
      reason: `Expected entityType 'FACTION' for Faction resolution, got '${reference.entityType}'.`
    };
  }

  return resolveEntityIdentity(currentState, historicalRecords, 'FACTION', name, reference, graph);
}

/**
 * Deterministic Narrative Seed identity resolver.
 */
export function resolveNarrativeSeedIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  contentOrId: string,
  reference?: EntityReferenceBundle,
  graph?: UniversalKnowledgeGraph
): EntityIdentityResolution {
  if (reference && reference.entityType !== 'NARRATIVE_SEED') {
    return {
      status: 'CONFLICT',
      candidates: [],
      normalizedName: normalizeIdentityText(contentOrId),
      reason: `Expected entityType 'NARRATIVE_SEED' for Narrative Seed resolution, got '${reference.entityType}'.`
    };
  }

  return resolveEntityIdentity(currentState, historicalRecords, 'NARRATIVE_SEED', contentOrId, reference, graph);
}

/**
 * Deterministic Character identity resolver.
 */
export function resolveCharacterIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  name: string,
  reference?: EntityReferenceBundle,
  graph?: UniversalKnowledgeGraph
): EntityIdentityResolution {
  if (reference && reference.entityType !== 'CHARACTER') {
    return {
      status: 'CONFLICT',
      candidates: [],
      normalizedName: normalizeIdentityText(name),
      reason: `Expected entityType 'CHARACTER' for Character resolution, got '${reference.entityType}'.`
    };
  }

  return resolveEntityIdentity(currentState, historicalRecords, 'CHARACTER', name, reference, graph);
}

/**
 * Deterministic inventory identity resolver.
 */
export function resolveInventoryItemIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  name: string,
  reference?: EntityReferenceBundle,
  graph?: UniversalKnowledgeGraph
): EntityIdentityResolution {
  if (reference && reference.entityType !== 'ITEM') {
    return {
      status: 'CONFLICT',
      candidates: [],
      normalizedName: normalizeIdentityText(name),
      reason: `Expected entityType 'ITEM' for inventory resolution, got '${reference.entityType}'.`
    };
  }

  return resolveEntityIdentity(currentState, historicalRecords, 'ITEM', name, reference, graph);
}

/**
 * Resolves identity for an inventory change entry from a candidate packet.
 */
export function resolveCandidateInventoryIdentity(
  currentState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  inventoryCandidate: NonNullable<CandidatePacket['inventoryChanges']>[number],
  graph?: UniversalKnowledgeGraph
): EntityIdentityResolution {
  return resolveInventoryItemIdentity(
    currentState,
    historicalRecords,
    inventoryCandidate.name,
    inventoryCandidate.entityReference,
    graph
  );
}

/**
 * Helper to fetch the current inventory item object if canonicalId resolves to an active inventory item.
 */
export function getResolvedCurrentInventoryItem(
  currentState: CanonicalState,
  resolution: EntityIdentityResolution
) {
  if (!resolution.canonicalId) return undefined;
  return currentState.character.inventory.find(item => item.id === resolution.canonicalId && item.quantity > 0);
}

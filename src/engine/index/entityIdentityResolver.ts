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
  'DUNGEON_REWARD',
  'LOOT',
  'PURCHASE',
  'CRAFTING',
  'ENCOUNTER',
  'FIRST_ENCOUNTER',
  'MET_DURING_STORY',
  'ENCOUNTERED_NEW_FACTION',
  'DISCOVERED_NARRATIVE_SEED',
  'EAVESDROP',
  'CREATION',
  'EXPLORATION',
  'GENESIS_STARTER',
  'SYSTEM_INITIALIZATION'
]);

/**
 * Resolves an authoritative event from historical records, offscreen records, or seeds.
 */
function findAuthoritativeEvent(
  eventId: string,
  currentState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = []
): { found: boolean; eventText?: string; isActive?: boolean; record?: ImmutableHistoricalRecord } {
  const cleanId = eventId.trim();
  if (!cleanId) return { found: false };

  // 1. Seeds
  const seed = currentState?.worldInfo?.seeds?.find(s => s.id === cleanId);
  if (seed) {
    return {
      found: true,
      eventText: seed.content,
      isActive: seed.status === 'active' || seed.status === 'dormant'
    };
  }

  // 2. Offscreen Records
  const offscreen = currentState?.worldInfo?.offscreenRecords?.find(o => o.id === cleanId);
  if (offscreen) {
    return {
      found: true,
      eventText: offscreen.eventDescription,
      isActive: true
    };
  }

  // 3. Camera Offscreen Events
  const camera = currentState?.worldInfo?.cameraOffscreenEvents?.find(c => c === cleanId);
  if (camera) {
    return {
      found: true,
      eventText: camera,
      isActive: true
    };
  }

  // 4. Historical Records
  const hist = historicalRecords.find(r => r.eventId === cleanId || r.recordId === cleanId);
  if (hist) {
    return {
      found: true,
      eventText: hist.details,
      isActive: true,
      record: hist
    };
  }

  // 5. Last committed event ID fallback
  if (currentState?.lastCommittedEventId === cleanId) {
    return {
      found: true,
      eventText: undefined,
      isActive: true
    };
  }

  return { found: false };
}

/**
 * Validates that the authoritative event specifically mentions or identifies the candidate entity.
 */
function checkCandidateSpecificity(
  candidateName: string,
  eventText?: string,
  histRecord?: ImmutableHistoricalRecord
): boolean {
  const cleanName = normalizeIdentityText(candidateName);
  if (!cleanName) return false;

  // 1. Check in eventText
  if (eventText) {
    const normEvent = normalizeIdentityText(eventText);
    if (normEvent.includes(cleanName)) {
      return true;
    }

    // Tokenized matching with Korean particle handling
    const KOREAN_PARTICLES = ['', '을', '를', '이', '가', '의', '과', '와', '으로', '로', '도', '에서', '에게', '이다', '입니다', '뿐', '만'];
    const eventWords = normEvent.split(/[\s,.\-?!;:()\[\]{}"'`~]+/).filter(Boolean);
    const tokenMatch = eventWords.some(w => {
      if (w === cleanName) return true;
      if (w.startsWith(cleanName)) {
        const suffix = w.slice(cleanName.length);
        return KOREAN_PARTICLES.includes(suffix);
      }
      return false;
    });
    if (tokenMatch) return true;
  }

  // 2. Check in historical record canonicalAction
  if (histRecord?.canonicalAction) {
    const actionStr = JSON.stringify(histRecord.canonicalAction).toLowerCase();
    if (actionStr.includes(cleanName)) {
      return true;
    }
  }

  return false;
}

const CREATION_ACQUISITION_KEYWORDS = [
  '획득', '얻', '줍', '주웠', '발견', '받', '수여', '하사', '제작', '만듦', '만들',
  '구입', '구매', '샀', '전수', '건네', '주었', '주어', '보상', '노획', '탈취', '전리품',
  '창조', '생성', '생겨', '조우', '만남', '만나', '접함', '접견', '대면', '등장', '합류', '결성', '창설', '동행', '편입', '영구',
  '격퇴', '처치', '토벌', '소탕', '클리어', '탐색', '수색', '비경', '복선', '소문',
  'acquire', 'obtain', 'find', 'discover', 'receive', 'gift', 'reward', 'loot',
  'craft', 'create', 'buy', 'purchase', 'encounter', 'meet', 'defeat', 'drop', 'grant', 'give', 'armory', 'companion', 'welcome', 'starter'
];

/**
 * Validates that the authoritative event and evidence actually prove the creation or acquisition
 * of the candidate entity (rather than a merely incidental or unrelated event).
 */
function checkCreationOrAcquisitionProof(
  evidence: NonNullable<EntityReferenceBundle['evidence']>,
  eventText?: string,
  histRecord?: ImmutableHistoricalRecord
): boolean {
  // 1. Cause validation: if cause is present, check against approved causes or valid novelty root
  if (evidence.cause) {
    if (!VALID_NOVELTY_CAUSES.has(evidence.cause)) {
      const causeUpper = evidence.cause.toUpperCase();
      const hasNoveltyRoot = [
        'REWARD', 'GIFT', 'DISCOVER', 'LOOT', 'ACQUIRE', 'CREATE', 'ENCOUNTER', 'MEET', 'BUY', 'CRAFT', 'SPAWN', 'STORY', 'FACTION', 'SEED', 'GENESIS', 'STARTER', 'COMPANION'
      ].some(root => causeUpper.includes(root));
      if (!hasNoveltyRoot) {
        return false;
      }
    }
  }

  // 2. Event text proof: Check for acquisition/creation/discovery context
  let hasProofInText = false;
  if (eventText) {
    const normEvent = normalizeIdentityText(eventText);
    hasProofInText = CREATION_ACQUISITION_KEYWORDS.some(kw => normEvent.includes(kw));
  }

  // 3. Historical record action proof:
  let hasProofInAction = false;
  if (histRecord) {
    if (
      histRecord.actionType === 'MODIFY_INVENTORY' ||
      histRecord.actionType === 'ADD_NPC' ||
      histRecord.actionType === 'ADD_FACTION' ||
      histRecord.actionType === 'ADD_NARRATIVE_SEED' ||
      histRecord.actionType === 'OVERWRITE_CHARACTER'
    ) {
      hasProofInAction = true;
    }
  }

  // 4. Evidence context proof:
  let hasProofInContext = false;
  if (isNonEmptyString(evidence.context)) {
    const normCtx = normalizeIdentityText(evidence.context);
    hasProofInContext = CREATION_ACQUISITION_KEYWORDS.some(kw => normCtx.includes(kw));
  }

  // Strict Rule: At least one authoritative proof mechanism (event text, record action, or backed context) must verify creation/acquisition
  return hasProofInText || hasProofInAction || hasProofInContext;
}

/**
 * Validates whether the provided reference bundle contains positive novelty/acquisition evidence
 * grounded in Canonical State and History to justify classifying an unknown entity as NOVEL.
 * 
 * Strict "NOVEL Gate" Hierarchy:
 * 1. Authoritative Event -> Event must exist in Canonical State or History, and must be active.
 *    (sourceNpcId alone is NOT authoritative evidence)
 * 2. Candidate Specificity -> The authoritative event must specifically ground the candidate entity.
 * 3. Creation/Acquisition Proof -> The event/evidence must prove the actual creation, acquisition,
 *    discovery, or generation of this specific candidate.
 * 4. Fail-Closed: If any step fails, return false (resulting in AMBIGUOUS, never NOVEL).
 */
export function hasPositiveNoveltyEvidence(
  reference?: EntityReferenceBundle,
  currentState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  graph?: UniversalKnowledgeGraph,
  candidateName?: string,
  entityType?: CanonicalEntityReferenceType
): boolean {
  if (!reference || !reference.evidence) return false;
  const ev = reference.evidence;

  // Fail-Closed: candidateName is required to verify specificity
  if (!candidateName || !candidateName.trim()) {
    return false;
  }

  // Step 1: Authoritative Event Requirement
  // Rule: verifiedEventId must be present and non-empty.
  // sourceNpcId alone is NOT authoritative evidence.
  if (!isNonEmptyString(ev.verifiedEventId)) {
    return false;
  }

  const authEvent = findAuthoritativeEvent(ev.verifiedEventId, currentState, historicalRecords);
  if (!authEvent.found || authEvent.isActive === false) {
    return false;
  }

  // If sourceNpcId is also claimed, verify that the NPC exists canonically or in graph
  if (isNonEmptyString(ev.sourceNpcId)) {
    const inCanonicalNpcs = (currentState?.worldInfo?.npcs || []).some(n => n.id === ev.sourceNpcId);
    let npcExists = inCanonicalNpcs;
    if (!npcExists) {
      if (graph) {
        const entity = graph.entities.get(ev.sourceNpcId);
        if (entity && entity.entityType === 'NPC') npcExists = true;
      } else if (currentState) {
        const tempGraph = buildKnowledgeGraph(currentState, historicalRecords);
        const entity = tempGraph.entities.get(ev.sourceNpcId);
        if (entity && entity.entityType === 'NPC') npcExists = true;
      }
    }
    if (!npcExists) {
      return false; // Non-existent NPC claimed
    }
  }

  // Step 2: Candidate Specificity
  // The authoritative event MUST specifically ground the candidate entity name
  const isSpecific = checkCandidateSpecificity(candidateName, authEvent.eventText, authEvent.record);
  if (!isSpecific) {
    return false;
  }

  // Step 3: Creation / Acquisition Proof
  // The event and evidence must prove the creation, acquisition, or discovery of the entity
  const isCreationProven = checkCreationOrAcquisitionProof(ev, authEvent.eventText, authEvent.record);
  if (!isCreationProven) {
    return false;
  }

  // All gates passed authoritatively -> NOVEL is justified
  return true;
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
  if (hasPositiveNoveltyEvidence(reference, currentState, historicalRecords, resolvedGraph, name, entityType)) {
    return {
      status: 'NOVEL',
      candidates: [],
      normalizedName,
      reason: `No existing canonical or historical ${entityType} identity matches '${name}', but positive acquisition/creation evidence was verified authoritatively. New ID may be allocated by Engine authority.`
    };
  }

  // Index miss without novelty evidence -> AMBIGUOUS (Mutation prohibited)
  return {
    status: 'AMBIGUOUS',
    candidates: [],
    normalizedName,
    reason: `Index miss: No existing ${entityType} matches '${name}', and positive novelty/acquisition evidence is absent, ungrounded, or unrelated to this candidate. Mutation is prohibited.`
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

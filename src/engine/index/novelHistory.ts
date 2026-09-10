import type { CanonicalEntityReferenceType, CandidatePacket } from '../../types';
import type { CanonicalState, ImmutableHistoricalRecord, StateTransitionProposal, IdentityInvalidationDeclaration } from '../types';
import {
  findAuthoritativeEvent,
  isAuthoritativeEventCausallyRelated,
  VALID_NOVELTY_CAUSES,
  CREATION_ACQUISITION_KEYWORDS,
  isNonEmptyString
} from './authoritativeEvidence';

/**
 * TRPG 3.1 Novel History Architecture
 *
 * Novel History is memory, not Canon authority.
 * A Novel History record preserves a normalized identity candidate across turns without
 * granting it canonical authority. Canonical IDs are strictly assigned only upon verified Canon promotion.
 *
 * Sovereign Rules:
 * 1. Novel History NEVER overwrites or replaces Canonical State.
 * 2. Active or Inactive Canon entities NEVER enter Novel History as 'NOVEL'.
 * 3. Lifecycle decisions are driven EXCLUSIVELY by Engine-derived signals; LLM candidate claims are ignored.
 * 4. Canon promotion requires the Novel entity to be the active actor or primary cause of a canonical change.
 * 5. Passive mentions in narrative prose remain strictly NOVEL.
 */

export type NovelHistoryLifecycle = 'NOVEL' | 'INACTIVE_NOVEL' | 'CANON_LINKED' | 'DEMOTED_NOVEL';

export interface DomainTransitionStep {
  readonly fromDomain: 'NOVEL' | 'CANON';
  readonly toDomain: 'NOVEL' | 'CANON';
  readonly version: number;
  readonly turn: number;
  readonly predecessorId?: string;
  readonly reason?: string;
}

export interface NovelHistoryRecord {
  readonly novelId: string;
  readonly entityType: CanonicalEntityReferenceType;
  readonly normalizedName: string;
  readonly displayName: string;
  readonly firstSeenTurn: number;
  readonly lastSeenTurn: number;
  readonly lastRelevantTurn: number;
  readonly seenCount: number;
  readonly lifecycle: NovelHistoryLifecycle;
  readonly canonicalId?: string;
  readonly linkedCanonicalAtTurn?: number;
  readonly sourceEventIds: readonly string[];
  readonly relatedSeedIds: readonly string[];
  readonly protagonistRelationActive: boolean;
  /** Engine verified whether this entity was an active causal actor in canonical state change */
  readonly engineVerifiedActiveActor?: boolean;
  /** Flag indicating whether this record has only been passively mentioned in prose */
  readonly isPassiveMentionOnly?: boolean;

  /** Demotion and lineage continuity tracking */
  readonly demotedAtTurn?: number;
  readonly demotedFromCanonicalId?: string;
  readonly demotionReason?: string;
  readonly transitionHistory?: readonly DomainTransitionStep[];
}

export interface NovelHistoryObservation {
  readonly novelId: string;
  readonly entityType: CanonicalEntityReferenceType;
  readonly normalizedName: string;
  readonly displayName: string;
  readonly turn: number;
  readonly eventId?: string;

  /** Engine-derived signal: Novel entity was verified by Engine as active actor or primary cause of a canonical change */
  readonly engineVerifiedActiveActor?: boolean;
  /** Engine-derived structural relationship to a Seed */
  readonly engineVerifiedSeedId?: string;
  /** Engine-derived structural interaction with protagonist in canonical state */
  readonly engineVerifiedProtagonistRelation?: boolean;
  /** Flag indicating whether the observation represents only passive narrative mention */
  readonly isPassiveMentionOnly?: boolean;

  /**
   * UNTRUSTED LLM-derived fields.
   * Retained for interface compatibility, but STRICTLY BLOCKED from driving lifecycle or promotion decisions.
   */
  readonly relatedSeedId?: string;
  readonly isRelevantToProtagonist?: boolean;
  readonly isManagementRelevant?: boolean;
}

export interface NovelHistoryPolicy {
  /** Turns without management-relevant activity before an entity may become inactive. */
  readonly inactivityTurns: Readonly<Record<CanonicalEntityReferenceType, number>>;
}

export const DEFAULT_NOVEL_HISTORY_POLICY: NovelHistoryPolicy = {
  inactivityTurns: {
    CHARACTER: 24,
    NPC: 8,
    FACTION: 16,
    ITEM: 6,
    NARRATIVE_SEED: 12
  }
};

export interface CanonPromotionSignals {
  /** Engine verified: Novel entity was the active actor or primary cause of a canonical change */
  readonly activeActorInCanonicalChange: boolean;
  /** Engine-derived structural relationship to an active Seed */
  readonly deeplyRelatedToSeed?: boolean;
  /** Engine-derived sustained/structural relationship to the protagonist */
  readonly closelyRelatedToProtagonist?: boolean;
  /** Indicates whether the entity was merely passively mentioned in narrative prose */
  readonly isPassiveMentionOnly?: boolean;
}

export interface CanonPromotionDecision {
  readonly promote: boolean;
  readonly reason:
    | 'ACTIVE_CANONICAL_ACTOR'
    | 'SEED_DEEP_RELATION'
    | 'PROTAGONIST_CLOSE_RELATION'
    | 'PASSIVE_MENTION_BLOCKED'
    | 'NO_CANON_PROMOTION_SIGNAL';
}

export interface CanonDemotionSignals {
  readonly targetCanonicalId: string;
  readonly entityType: CanonicalEntityReferenceType;
  readonly targetName?: string;
  /** Raw status string (e.g. from SET_NPC_STATUS, RESOLVE_NARRATIVE_SEED) to verify non-demotion of inactive canon */
  readonly rawStatus?: string;
  /** Authoritative invalidation claim from Engine */
  readonly invalidationClaim?: {
    readonly claimType: string;
    readonly evidenceIds: readonly string[];
    readonly reason?: string;
  };
  /** Verified invalidation event ID */
  readonly verifiedInvalidationEventId?: string;
  /** Inactivity turns passed (used to verify inactivity alone does not cause demotion) */
  readonly inactivityTurnsPassed?: number;
  /** LLM claimed demotion flag (untrusted) */
  readonly llmClaimedDemotion?: boolean;
}

export interface CanonDemotionDecision {
  readonly demote: boolean;
  readonly reason:
    | 'AUTHORITATIVE_CAUSAL_INVALIDATION'
    | 'CANON_INACTIVE_STATUS_NOT_DEMOTION'
    | 'INACTIVITY_ONLY_NOT_DEMOTION'
    | 'LLM_CLAIM_REJECTED'
    | 'NO_INVALIDATION_SIGNAL'
    | 'FAKE_OR_UNVERIFIED_EVENT'
    | 'UNRELATED_EVENT'
    | 'NON_IDENTITY_INVALIDATION_EVENT'
    | 'INSUFFICIENT_EVIDENCE';
  readonly validatedEventId?: string;
}

/** Normalizes the identity key used by Novel History. */
export function normalizeNovelIdentity(value: string): string {
  if (!value || typeof value !== 'string') return '';
  return value.trim().toLocaleLowerCase().normalize('NFKC').replace(/\s+/g, ' ');
}

/**
 * Checks whether an entity name/ID corresponds to an Inactive (or Active) Canon entity.
 * Inactive Canon includes:
 * - Dead NPCs
 * - Items with quantity <= 0 or removed from inventory
 * - Resolved or dormant Narrative Seeds
 * - Any entity historically recorded in ImmutableHistoricalRecords
 *
 * Sovereign Rule: An Inactive Canon entity MUST NEVER be classified as NOVEL.
 */
export function isInactiveCanon(
  nameOrId: string,
  entityType: CanonicalEntityReferenceType,
  canonicalState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = []
): boolean {
  const normalized = normalizeNovelIdentity(nameOrId);
  if (!normalized) return false;

  // Active Canon entities in canonicalState are never considered Inactive Canon
  if (isActiveCanon(normalized, entityType, canonicalState)) {
    return false;
  }

  // 1. Check current Canonical State for inactive entries
  if (canonicalState) {
    if (entityType === 'NPC' && Array.isArray(canonicalState.worldInfo?.npcs)) {
      for (const npc of canonicalState.worldInfo.npcs) {
        if (!npc) continue;
        const matches =
          normalizeNovelIdentity(npc.name) === normalized ||
          normalizeNovelIdentity(npc.id) === normalized ||
          (npc.alias && normalizeNovelIdentity(npc.alias) === normalized);
        if (matches) {
          if (npc.status === 'DEAD') return true;
        }
      }
    }

    if (entityType === 'ITEM' && Array.isArray(canonicalState.character?.inventory)) {
      for (const item of canonicalState.character.inventory) {
        if (!item) continue;
        const matches =
          normalizeNovelIdentity(item.name) === normalized ||
          normalizeNovelIdentity(item.id) === normalized;
        if (matches) {
          if ((item.quantity ?? 1) <= 0) return true;
        }
      }
    }

    if (entityType === 'NARRATIVE_SEED' && Array.isArray(canonicalState.worldInfo?.seeds)) {
      for (const seed of canonicalState.worldInfo.seeds) {
        if (!seed) continue;
        const matches =
          normalizeNovelIdentity(seed.content) === normalized ||
          normalizeNovelIdentity(seed.id) === normalized;
        if (matches) {
          const status = seed.status as any;
          if (status === 'resolved' || status === 'RESOLVED' || status === 'dormant' || status === 'ARCHIVED') {
            return true;
          }
        }
      }
    }
  }

  // 2. Check Immutable Historical Records for past canonical entities no longer active
  for (const rec of historicalRecords) {
    if (!rec) continue;
    const actionPayload: any = rec.canonicalAction?.payload;
    let parsed: any = null;
    if (rec.details) {
      try {
        const jsonMatch = rec.details.match(/\{.*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // ignore
      }
    }

    if (entityType === 'NPC') {
      const histId = parsed?.id || (rec.actionType === 'ADD_NPC' ? actionPayload?.id : undefined);
      const histName = parsed?.name || (rec.actionType === 'ADD_NPC' ? actionPayload?.name : undefined);
      if (histId && normalizeNovelIdentity(histId) === normalized) return true;
      if (histName && normalizeNovelIdentity(histName) === normalized) return true;
    }

    if (entityType === 'ITEM') {
      const itemData = parsed?.item || (rec.actionType === 'MODIFY_INVENTORY' ? actionPayload?.item : undefined);
      if (itemData) {
        if (itemData.id && normalizeNovelIdentity(itemData.id) === normalized) return true;
        if (itemData.name && normalizeNovelIdentity(itemData.name) === normalized) return true;
      }
    }

    if (entityType === 'FACTION') {
      const facId = parsed?.id || (rec.actionType === 'ADD_FACTION' ? actionPayload?.id : undefined);
      const facName = parsed?.name || (rec.actionType === 'ADD_FACTION' ? actionPayload?.name : undefined);
      if (facId && normalizeNovelIdentity(facId) === normalized) return true;
      if (facName && normalizeNovelIdentity(facName) === normalized) return true;
    }

    if (entityType === 'NARRATIVE_SEED') {
      const seedId = parsed?.id || (rec.actionType === 'ADD_NARRATIVE_SEED' ? actionPayload?.id : undefined);
      const seedContent = parsed?.content || (rec.actionType === 'ADD_NARRATIVE_SEED' ? actionPayload?.content : undefined);
      if (seedId && normalizeNovelIdentity(seedId) === normalized) return true;
      if (seedContent && normalizeNovelIdentity(seedContent) === normalized) return true;
    }
  }

  return false;
}

/**
 * Checks whether an entity is currently an active Canon entity in Canonical State.
 */
export function isActiveCanon(
  nameOrId: string,
  entityType: CanonicalEntityReferenceType,
  canonicalState?: CanonicalState
): boolean {
  const normalized = normalizeNovelIdentity(nameOrId);
  if (!normalized || !canonicalState) return false;

  if (entityType === 'CHARACTER') {
    if (canonicalState.character?.name && normalizeNovelIdentity(canonicalState.character.name) === normalized) {
      return true;
    }
    if (normalized === 'protagonist' || normalized === '주인공') return true;
  }

  if (entityType === 'NPC' && Array.isArray(canonicalState.worldInfo?.npcs)) {
    for (const npc of canonicalState.worldInfo.npcs) {
      if (!npc) continue;
      if (
        normalizeNovelIdentity(npc.name) === normalized ||
        normalizeNovelIdentity(npc.id) === normalized ||
        (npc.alias && normalizeNovelIdentity(npc.alias) === normalized)
      ) {
        // UNMET, unencountered (metInStory === false), or DEAD NPCs are not active canon
        if (npc.status === 'DEAD' || npc.status === 'UNMET' || npc.metInStory === false) {
          return false;
        }
        return true;
      }
    }
  }

  if (entityType === 'FACTION' && Array.isArray(canonicalState.worldInfo?.factions)) {
    for (const fac of canonicalState.worldInfo.factions) {
      if (!fac) continue;
      if (normalizeNovelIdentity(fac.name) === normalized || normalizeNovelIdentity(fac.id) === normalized) {
        return true;
      }
    }
  }

  if (entityType === 'ITEM' && Array.isArray(canonicalState.character?.inventory)) {
    for (const item of canonicalState.character.inventory) {
      if (!item) continue;
      if (normalizeNovelIdentity(item.name) === normalized || normalizeNovelIdentity(item.id) === normalized) {
        return (item.quantity ?? 1) > 0;
      }
    }
  }

  if (entityType === 'NARRATIVE_SEED' && Array.isArray(canonicalState.worldInfo?.seeds)) {
    for (const seed of canonicalState.worldInfo.seeds) {
      if (!seed) continue;
      if (normalizeNovelIdentity(seed.content) === normalized || normalizeNovelIdentity(seed.id) === normalized) {
        const status = seed.status as any;
        return status !== 'resolved' && status !== 'RESOLVED' && status !== 'dormant' && status !== 'ARCHIVED';
      }
    }
  }

  return false;
}

/**
 * Evaluates Canon Promotion for a Novel Entity based strictly on Engine-verified signals.
 *
 * Promotion Criteria:
 * - If the Novel Entity actively/causally drives a Canonical State change as verified by the Engine,
 *   it is immediately promoted.
 * - If the Novel Entity was merely passively mentioned in prose, it is NOT promoted.
 * - LLM candidate signals (e.g. unverified claims) are strictly ignored.
 */
export function evaluateCanonPromotion(
  signals: CanonPromotionSignals
): CanonPromotionDecision {
  // 1. Passive mention defense: If explicitly flagged as passive mention without active causality, block promotion.
  if (signals.isPassiveMentionOnly && !signals.activeActorInCanonicalChange) {
    return { promote: false, reason: 'PASSIVE_MENTION_BLOCKED' };
  }

  // 2. Primary Sovereign Gate: Novel Entity is the active actor / primary cause of a canonical change
  if (signals.activeActorInCanonicalChange) {
    return { promote: true, reason: 'ACTIVE_CANONICAL_ACTOR' };
  }

  // 3. Engine verified structural Seed relation
  if (signals.deeplyRelatedToSeed) {
    return { promote: true, reason: 'SEED_DEEP_RELATION' };
  }

  // 4. Engine verified sustained protagonist relationship
  if (signals.closelyRelatedToProtagonist) {
    return { promote: true, reason: 'PROTAGONIST_CLOSE_RELATION' };
  }

  return { promote: false, reason: 'NO_CANON_PROMOTION_SIGNAL' };
}

/**
 * Deterministic Semantic Verification for Identity Invalidation.
 *
 * TRPG 3.1 Sovereign Constitution Directives:
 * 1. Must judge ONLY committed Canonical Events in Sovereign Engine.
 * 2. eventId -> authoritative event -> target canonical entity -> causal relation -> actual canonical semantic mutation.
 * 3. Natural language text, claimType, reason, LLM declarations are auxiliary only, NEVER authority.
 * 4. Regex/keyword matching on natural language is strictly FORBIDDEN.
 * 5. Death, missing, inactivity, movement, combat, damage, name change, or casual fraud mentions MUST NOT demote.
 * 6. Another entity's invalidation MUST NOT be misattributed to the target canonical entity.
 * 7. Uncommitted/fake/unrelated events are rejected.
 * 8. Only events where the target canonical entity's identity is canonically mutated/invalidated qualify for demotion.
 */
export function isEventDeterministicIdentityInvalidation(
  eventId: string,
  targetEntity: { name?: string; id?: string; entityType?: CanonicalEntityReferenceType },
  authEv: { found: boolean; eventText?: string; isActive?: boolean; record?: ImmutableHistoricalRecord },
  canonicalState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = []
): boolean {
  const cleanId = eventId ? eventId.trim() : '';
  if (!cleanId) return false;

  const targetId = targetEntity.id ? targetEntity.id.trim() : '';
  if (!targetId) return false;

  if (!authEv.found || authEv.isActive === false) return false;

  // 1. Gather all historical records matching this event
  const matchingRecords: ImmutableHistoricalRecord[] = [];
  if (authEv.record && (authEv.record.eventId === cleanId || authEv.record.recordId === cleanId)) {
    matchingRecords.push(authEv.record);
  }
  for (const rec of historicalRecords) {
    if ((rec.eventId === cleanId || rec.recordId === cleanId) && !matchingRecords.includes(rec)) {
      matchingRecords.push(rec);
    }
  }

  // Authoritative canonical invalidation causes in evidence
  const CANONICAL_INVALIDATION_CAUSES: ReadonlySet<string> = new Set([
    'CANON_IDENTITY_INVALIDATION',
    'IDENTITY_INVALIDATION',
    'IDENTITY_FABRICATION',
    'IMPERSONATION',
    'FORGERY_DISCOVERED',
    'CANON_REVOCATION',
    'CANON_DEMOTION'
  ]);

  const INVALID_RESOLVED_IDS: ReadonlySet<string> = new Set([
    'INVALID',
    'DEMOTED_NOVEL',
    'IMPOSTOR',
    'FABRICATED'
  ]);

  const INVALID_ROLES: ReadonlySet<string> = new Set([
    'IMPOSTOR',
    'FAKE',
    'FABRICATED',
    'UNMASKED_IMPOSTOR'
  ]);

  let hasTargetSemanticInvalidation = false;

  for (const rec of matchingRecords) {
    const action = rec.canonicalAction;
    if (!action) continue;

    // Check action for NPC
    if (action.type === 'UPDATE_NPC') {
      const payload = action.payload;
      // MUST strictly match target entity ID. Actions for other entities MUST NOT demote target!
      if (payload && payload.id === targetId) {
        const changes = payload.changes;
        if (changes) {
          // If entityReference specifies identity invalidation:
          const entRef = changes.entityReference;
          if (entRef) {
            const resId = entRef.resolvedEntityId ? entRef.resolvedEntityId.trim() : '';
            const cause = entRef.evidence?.cause ? entRef.evidence.cause.trim() : '';
            if (INVALID_RESOLVED_IDS.has(resId) || CANONICAL_INVALIDATION_CAUSES.has(cause)) {
              hasTargetSemanticInvalidation = true;
            }
          }

          // If role specifies identity invalidation:
          if (changes.role && INVALID_ROLES.has(changes.role.trim().toUpperCase())) {
            hasTargetSemanticInvalidation = true;
          }
        }
      }
    }

    // Check action for ITEM
    if (action.type === 'MODIFY_INVENTORY' && targetEntity.entityType === 'ITEM') {
      const payload = action.payload;
      const itemId = payload?.item?.id;
      const itemName = payload?.item?.name;
      if ((itemId && itemId === targetId) || (targetEntity.name && itemName === targetEntity.name)) {
        const cause = payload.acquisition?.cause ? String(payload.acquisition.cause).trim() : '';
        const entRef = payload.item?.entityReference;
        const resId = entRef?.resolvedEntityId ? entRef.resolvedEntityId.trim() : '';
        const refCause = entRef?.evidence?.cause ? entRef.evidence.cause.trim() : '';

        if (
          CANONICAL_INVALIDATION_CAUSES.has(cause) ||
          cause === 'FORGERY_CONFISCATED' ||
          INVALID_RESOLVED_IDS.has(resId) ||
          CANONICAL_INVALIDATION_CAUSES.has(refCause)
        ) {
          hasTargetSemanticInvalidation = true;
        }
      }
    }

    // Check action for FACTION
    if (action.type === 'UPDATE_FACTION' && targetEntity.entityType === 'FACTION') {
      const payload = action.payload;
      if (payload && payload.id === targetId) {
        const changes = payload.changes;
        const entRef = changes?.entityReference;
        const resId = entRef?.resolvedEntityId ? entRef.resolvedEntityId.trim() : '';
        const refCause = entRef?.evidence?.cause ? entRef.evidence.cause.trim() : '';
        if (
          INVALID_RESOLVED_IDS.has(resId) ||
          CANONICAL_INVALIDATION_CAUSES.has(refCause) ||
          ((changes as any)?.role && INVALID_ROLES.has((changes as any).role.trim().toUpperCase()))
        ) {
          hasTargetSemanticInvalidation = true;
        }
      }
    }
  }

  // Check current canonical state if target entity was mutated by THIS SPECIFIC event (cleanId)
  if (!hasTargetSemanticInvalidation && canonicalState?.worldInfo?.npcs && (!targetEntity.entityType || targetEntity.entityType === 'NPC')) {
    const npc = canonicalState.worldInfo.npcs.find(n => n.id === targetId);
    if (npc) {
      const entRef = npc.entityReference;
      const resId = entRef?.resolvedEntityId ? entRef.resolvedEntityId.trim() : '';
      const verifiedEvId = entRef?.evidence?.verifiedEventId;
      const cause = entRef?.evidence?.cause ? entRef.evidence.cause.trim() : '';
      // The canonical state mutation MUST be authoritatively verified to have originated from cleanId
      if (verifiedEvId === cleanId) {
        if (
          INVALID_RESOLVED_IDS.has(resId) ||
          CANONICAL_INVALIDATION_CAUSES.has(cause) ||
          (npc.role && INVALID_ROLES.has(npc.role.trim().toUpperCase()))
        ) {
          hasTargetSemanticInvalidation = true;
        }
      }
    }
  }

  return hasTargetSemanticInvalidation;
}

/**
 * Pure decision gate for evaluating Canon Demotion.
 *
 * Constitution Rules:
 * 1. "DEAD", "CONSUMED", "RESOLVED", "DORMANT", "ARCHIVED", inactivity MUST NOT be interpreted as Demotion.
 * 2. Inactivity or absence of appearance is NOT Demotion.
 * 3. LLM demotion claims are untrusted and rejected.
 * 4. Demotion requires authoritative evidence and verified causal invalidation.
 * 5. Fails closed if any verification step fails.
 */
export function evaluateCanonDemotion(
  signals: CanonDemotionSignals,
  canonicalState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = []
): CanonDemotionDecision {
  // Defense 1: Reject standard inactive statuses (DEAD, CONSUMED, RESOLVED, DORMANT, ARCHIVED, MISSING, INACTIVE)
  if (signals.rawStatus) {
    const s = signals.rawStatus.toUpperCase();
    if (
      s === 'DEAD' ||
      s === 'CONSUMED' ||
      s === 'RESOLVED' ||
      s === 'DORMANT' ||
      s === 'ARCHIVED' ||
      s === 'MISSING' ||
      s === 'INACTIVE'
    ) {
      return { demote: false, reason: 'CANON_INACTIVE_STATUS_NOT_DEMOTION' };
    }
  }

  // Defense 2: Reject inactivity-only signals
  if (typeof signals.inactivityTurnsPassed === 'number' && signals.inactivityTurnsPassed > 0) {
    if (!signals.verifiedInvalidationEventId && !signals.invalidationClaim) {
      return { demote: false, reason: 'INACTIVITY_ONLY_NOT_DEMOTION' };
    }
  }

  // Defense 3: Reject standalone LLM claims
  if (signals.llmClaimedDemotion && !signals.verifiedInvalidationEventId) {
    return { demote: false, reason: 'LLM_CLAIM_REJECTED' };
  }

  // Defense 4: Must have an authoritative committed event ID (no evidenceIds[0] fallback)
  const eventId = signals.verifiedInvalidationEventId;
  if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
    return { demote: false, reason: signals.llmClaimedDemotion ? 'LLM_CLAIM_REJECTED' : 'NO_INVALIDATION_SIGNAL' };
  }

  // If invalidationClaim exists, verify claimType
  if (signals.invalidationClaim) {
    const ct = signals.invalidationClaim.claimType;
    const VALID_INVALIDATION_CLAIM_TYPES = new Set([
      'CANON_IDENTITY_INVALIDATION',
      'CANON_REVOCATION',
      'IDENTITY_FABRICATION_DISCOVERY',
      'CANON_DEMOTION'
    ]);
    if (!VALID_INVALIDATION_CLAIM_TYPES.has(ct)) {
      return { demote: false, reason: 'NO_INVALIDATION_SIGNAL' };
    }
  }

  // Defense 5: Authoritative Event verification (fail-closed if event doesn't exist or is inactive)
  const authEv = findAuthoritativeEvent(eventId, canonicalState, historicalRecords);
  if (!authEv.found || authEv.isActive === false) {
    return { demote: false, reason: 'FAKE_OR_UNVERIFIED_EVENT' };
  }

  // Defense 6: Causal Invalidation verification
  // The event must specifically be causally related to the entity being invalidated
  const targetName = signals.targetName || signals.targetCanonicalId;
  const isCausallyRelated = isAuthoritativeEventCausallyRelated(
    eventId,
    { name: targetName, id: signals.targetCanonicalId, entityType: signals.entityType },
    undefined,
    canonicalState,
    historicalRecords
  );

  if (!isCausallyRelated) {
    return { demote: false, reason: 'UNRELATED_EVENT' };
  }

  // Defense 7: Deterministic Identity-Invalidation Semantic Verification
  // The event details/actionType/payload must specifically denote actual identity invalidation,
  // impersonation discovery, or forged/fabricated identity.
  // Mere death, movement, damage, item loss, or normal status/state change is NOT demotion.
  const isIdentityInvalidation = isEventDeterministicIdentityInvalidation(
    eventId,
    { name: targetName, id: signals.targetCanonicalId, entityType: signals.entityType },
    authEv,
    canonicalState,
    historicalRecords
  );

  if (!isIdentityInvalidation) {
    return { demote: false, reason: 'NON_IDENTITY_INVALIDATION_EVENT' };
  }

  return {
    demote: true,
    reason: 'AUTHORITATIVE_CAUSAL_INVALIDATION',
    validatedEventId: eventId
  };
}

/**
 * Checks if a novel entity is inactive based on management relevance.
 */
export function isNovelHistoryInactive(
  record: Pick<NovelHistoryRecord, 'entityType' | 'lastRelevantTurn' | 'protagonistRelationActive'>,
  currentTurn: number,
  policy: NovelHistoryPolicy = DEFAULT_NOVEL_HISTORY_POLICY
): boolean {
  if (record.protagonistRelationActive) return false;

  const threshold = policy.inactivityTurns[record.entityType];
  if (!Number.isFinite(threshold) || threshold < 1) return false;

  return currentTurn - record.lastRelevantTurn >= threshold;
}

/**
 * Classifies the lifecycle transition for a novel record.
 * CANON_LINKED entities are never demoted.
 */
export function classifyNovelHistoryLifecycle(
  record: Pick<NovelHistoryRecord, 'entityType' | 'lastRelevantTurn' | 'protagonistRelationActive' | 'lifecycle'>,
  currentTurn: number,
  policy: NovelHistoryPolicy = DEFAULT_NOVEL_HISTORY_POLICY
): NovelHistoryLifecycle {
  if (record.lifecycle === 'CANON_LINKED') return 'CANON_LINKED';
  if (record.lifecycle === 'DEMOTED_NOVEL') return 'DEMOTED_NOVEL';
  if (isNovelHistoryInactive(record, currentTurn, policy)) return 'INACTIVE_NOVEL';
  return 'NOVEL';
}

/**
 * Pure reducer for one normalized Novel observation.
 *
 * Critical Defenses:
 * 1. If an entity is already an Active Canon or Inactive Canon, it is BLOCKED from entering Novel History as NOVEL.
 * 2. LLM-derived fields (`relatedSeedId`, `isRelevantToProtagonist`, `isManagementRelevant`) are completely ignored.
 *    Only Engine-derived signals (`engineVerified*`) can alter lifecycle.
 * 3. Existing CANON_LINKED and DEMOTED_NOVEL records are NEVER demoted to NOVEL by subsequent passive observations.
 */
export function observeNovelHistory(
  existing: readonly NovelHistoryRecord[],
  observation: NovelHistoryObservation,
  canonicalState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  options?: { allowNewlyCommittedCanon?: boolean }
): NovelHistoryRecord[] {
  const normalized = normalizeNovelIdentity(observation.normalizedName || observation.displayName);
  if (!normalized) return [...existing];

  const index = existing.findIndex(
    r => r.entityType === observation.entityType && r.normalizedName === normalized
  );

  // Sovereign Defense: Block Active Canon and Inactive Canon from becoming NOVEL,
  // UNLESS this observation is specifically recording a newly committed canon entity from this turn,
  // OR the entity is already recorded in Novel History as CANON_LINKED (to update seenCount/lastSeenTurn).
  const isNewlyCommitted = options?.allowNewlyCommittedCanon === true;
  const isExistingCanonLinked = index >= 0 && existing[index].lifecycle === 'CANON_LINKED';

  if (!isNewlyCommitted && !isExistingCanonLinked) {
    if (
      isActiveCanon(normalized, observation.entityType, canonicalState) ||
      isInactiveCanon(normalized, observation.entityType, canonicalState, historicalRecords)
    ) {
      // Already part of Canon or historical Canon; do not record as NOVEL.
      return [...existing];
    }
  } else if (isNewlyCommitted) {
    // Even if newly committed, Inactive Canon (e.g. DEAD) must always be blocked
    if (isInactiveCanon(normalized, observation.entityType, canonicalState, historicalRecords)) {
      return [...existing];
    }
  }

  // Engine-derived signals ONLY (LLM fields strictly ignored)
  const engineSeedId = observation.engineVerifiedSeedId;
  const engineProtagonistRelation = observation.engineVerifiedProtagonistRelation === true;

  if (index < 0) {
    const novel: NovelHistoryRecord = {
      novelId: observation.novelId,
      entityType: observation.entityType,
      normalizedName: normalized,
      displayName: observation.displayName.trim() || observation.normalizedName.trim(),
      firstSeenTurn: observation.turn,
      lastSeenTurn: observation.turn,
      lastRelevantTurn: observation.turn,
      seenCount: 1,
      lifecycle: 'NOVEL',
      sourceEventIds: observation.eventId ? [observation.eventId] : [],
      relatedSeedIds: engineSeedId ? [engineSeedId] : [],
      protagonistRelationActive: engineProtagonistRelation,
      engineVerifiedActiveActor: observation.engineVerifiedActiveActor === true,
      isPassiveMentionOnly: observation.isPassiveMentionOnly !== false
    };
    return [...existing, novel];
  }

  const current = existing[index];

  // Preserve CANON_LINKED and DEMOTED_NOVEL status permanently against passive observations
  let targetLifecycle: NovelHistoryLifecycle = 'NOVEL';
  if (current.lifecycle === 'CANON_LINKED') targetLifecycle = 'CANON_LINKED';
  else if (current.lifecycle === 'DEMOTED_NOVEL') targetLifecycle = 'DEMOTED_NOVEL';

  const sourceEventIds = observation.eventId && !current.sourceEventIds.includes(observation.eventId)
    ? [...current.sourceEventIds, observation.eventId]
    : [...current.sourceEventIds];

  const relatedSeedIds = engineSeedId && !current.relatedSeedIds.includes(engineSeedId)
    ? [...current.relatedSeedIds, engineSeedId]
    : [...current.relatedSeedIds];

  const next: NovelHistoryRecord = {
    ...current,
    lastSeenTurn: Math.max(current.lastSeenTurn, observation.turn),
    lastRelevantTurn: Math.max(current.lastRelevantTurn, observation.turn),
    seenCount: current.seenCount + 1,
    lifecycle: targetLifecycle,
    sourceEventIds,
    relatedSeedIds,
    protagonistRelationActive: engineProtagonistRelation || current.protagonistRelationActive,
    engineVerifiedActiveActor: observation.engineVerifiedActiveActor === true || current.engineVerifiedActiveActor === true,
    isPassiveMentionOnly: observation.isPassiveMentionOnly !== false && current.isPassiveMentionOnly !== false
  };

  return existing.map((record, i) => (i === index ? next : record));
}

/**
 * Promotes a Novel History record to CANON_LINKED with its assigned Canonical ID.
 * Permanent transition; records full lineage versioning (+1).
 */
export function promoteNovelRecordToCanon(
  existing: readonly NovelHistoryRecord[],
  novelIdOrName: string,
  entityType: CanonicalEntityReferenceType,
  canonicalId: string,
  turn: number
): NovelHistoryRecord[] {
  const normalized = normalizeNovelIdentity(novelIdOrName);
  if (!normalized) return [...existing];

  return existing.map(record => {
    if (
      record.entityType === entityType &&
      (record.novelId === novelIdOrName || record.normalizedName === normalized)
    ) {
      const prevHistory = record.transitionHistory || [
        { fromDomain: 'NOVEL', toDomain: 'NOVEL', version: 1, turn: record.firstSeenTurn }
      ];
      const latestVersion = prevHistory[prevHistory.length - 1]?.version ?? 1;
      const nextVersion = latestVersion + 1;

      const nextHistory = [
        ...prevHistory,
        {
          fromDomain: 'NOVEL' as const,
          toDomain: 'CANON' as const,
          version: nextVersion,
          turn,
          predecessorId: record.novelId
        }
      ];

      return {
        ...record,
        lifecycle: 'CANON_LINKED' as NovelHistoryLifecycle,
        canonicalId,
        linkedCanonicalAtTurn: turn,
        engineVerifiedActiveActor: true,
        isPassiveMentionOnly: false,
        transitionHistory: Object.freeze(nextHistory)
      };
    }
    return record;
  });
}

/**
 * Demotes a Canon entity back to NOVEL domain in Novel History upon Engine-verified invalidation.
 *
 * Invariants:
 * - The original Canon identity and history are NEVER deleted.
 * - NovelHistoryRecord is either updated or created with lifecycle 'DEMOTED_NOVEL'.
 * - Domain transition lineage is recorded and version increments (+1).
 */
export function demoteCanonRecordToNovel(
  existing: readonly NovelHistoryRecord[],
  canonicalId: string,
  entityType: CanonicalEntityReferenceType,
  name: string,
  turn: number,
  reason: string,
  validatedEventId?: string
): { updatedRecords: readonly NovelHistoryRecord[]; novelRecord: NovelHistoryRecord } {
  const norm = normalizeNovelIdentity(name || canonicalId);
  const normalizedCanonId = canonicalId.trim();

  const index = existing.findIndex(
    r => (r.canonicalId && r.canonicalId === normalizedCanonId) ||
         (r.entityType === entityType && r.normalizedName === norm)
  );

  if (index >= 0) {
    const current = existing[index];
    const prevHistory = current.transitionHistory || [
      { fromDomain: 'NOVEL', toDomain: 'NOVEL', version: 1, turn: current.firstSeenTurn },
      { fromDomain: 'NOVEL', toDomain: 'CANON', version: 2, turn: current.linkedCanonicalAtTurn || turn, predecessorId: current.novelId }
    ];
    const latestVersion = prevHistory[prevHistory.length - 1]?.version ?? 2;
    const nextVersion = latestVersion + 1;

    const nextHistory = [
      ...prevHistory,
      {
        fromDomain: 'CANON' as const,
        toDomain: 'NOVEL' as const,
        version: nextVersion,
        turn,
        predecessorId: normalizedCanonId,
        reason
      }
    ];

    const sourceEventIds = validatedEventId && !current.sourceEventIds.includes(validatedEventId)
      ? [...current.sourceEventIds, validatedEventId]
      : [...current.sourceEventIds];

    const updated: NovelHistoryRecord = {
      ...current,
      lifecycle: 'DEMOTED_NOVEL',
      lastSeenTurn: Math.max(current.lastSeenTurn, turn),
      lastRelevantTurn: Math.max(current.lastRelevantTurn, turn),
      demotedAtTurn: turn,
      demotedFromCanonicalId: normalizedCanonId,
      demotionReason: reason,
      sourceEventIds,
      transitionHistory: Object.freeze(nextHistory)
    };

    const newRecords = existing.map((r, i) => (i === index ? updated : r));
    return { updatedRecords: Object.freeze(newRecords), novelRecord: updated };
  } else {
    // Entity was Genesis Canon (not previously tracked in Novel History)
    const novelId = `nov-${entityType.toLowerCase()}-${norm.replace(/\s+/g, '-') || normalizedCanonId}`;
    const transitionHistory = [
      { fromDomain: 'CANON' as const, toDomain: 'CANON' as const, version: 1, turn: 1 },
      {
        fromDomain: 'CANON' as const,
        toDomain: 'NOVEL' as const,
        version: 2,
        turn,
        predecessorId: normalizedCanonId,
        reason
      }
    ];

    const newRecord: NovelHistoryRecord = {
      novelId,
      entityType,
      normalizedName: norm,
      displayName: name.trim() || normalizedCanonId,
      firstSeenTurn: turn,
      lastSeenTurn: turn,
      lastRelevantTurn: turn,
      seenCount: 1,
      lifecycle: 'DEMOTED_NOVEL',
      canonicalId: normalizedCanonId,
      demotedAtTurn: turn,
      demotedFromCanonicalId: normalizedCanonId,
      demotionReason: reason,
      sourceEventIds: validatedEventId ? [validatedEventId] : [],
      relatedSeedIds: [],
      protagonistRelationActive: false,
      engineVerifiedActiveActor: false,
      isPassiveMentionOnly: false,
      transitionHistory: Object.freeze(transitionHistory)
    };

    return { updatedRecords: Object.freeze([...existing, newRecord]), novelRecord: newRecord };
  }
}

/**
 * Reappearance lookup in Novel History.
 */
export function findNovelHistoryMatch(
  records: readonly NovelHistoryRecord[],
  entityType: CanonicalEntityReferenceType,
  name: string
): NovelHistoryRecord | undefined {
  const normalized = normalizeNovelIdentity(name);
  if (!normalized) return undefined;
  return records.find(r => r.entityType === entityType && r.normalizedName === normalized);
}

export interface CandidateObservationResult {
  readonly updatedRecords: readonly NovelHistoryRecord[];
  readonly promotedCount: number;
  readonly demotedCount?: number;
}

/**
 * Runtime Pipeline Connector for Novel History (Section 5-1).
 *
 * Connects the real game turn pipeline:
 * LLM -> Candidate -> Recovery Gate -> Engine-derived observation -> Novel History
 *
 * Evaluates candidate mentions and proposal actions:
 * - Novel entities driving canonical mutations are observed with engineVerifiedActiveActor: true,
 *   prompting immediate Canon promotion evaluation.
 * - Novel entities passively mentioned without state changes are observed with isPassiveMentionOnly: true,
 *   maintaining strictly NOVEL status.
 * - Active Canon and Inactive Canon are protected and NEVER recorded as NOVEL.
 * - LLM candidate lifecycle signals are blocked.
 */
/**
 * Helper to determine if a novel entity is an Engine-verified Active Actor / Primary Cause
 * in a canonical state change for this turn.
 *
 * Strict Constitutional Invariants:
 * 1. Target of a canonical action alone does NOT confer Active Actor status.
 * 2. Mere presence of ADD_NPC, MODIFY_INVENTORY, ADD_FACTION, ADD_NARRATIVE_SEED without causal evidence fails closed to false.
 * 3. LLM-claimed signals (claimedEntityId, resolvedEntityId, relatedSeedId, isRelevantToProtagonist, isManagementRelevant) are strictly unprivileged.
 * 4. Requires independent Engine causal evidence (sourceNpcId, verifiedEventId, acquisition with valid cause/cost/evidence).
 */
function isEntityEngineVerifiedActiveActor(
  item: { name: string; entityType: CanonicalEntityReferenceType },
  norm: string,
  candidate: CandidatePacket,
  proposal: StateTransitionProposal,
  canonicalState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = []
): boolean {
  if (item.entityType === 'NPC') {
    // Look up this NPC in proposal actions or canonical state
    const matchingNpcAction = proposal.actions.find(
      a => (a.type === 'ADD_NPC' || a.type === 'UPDATE_NPC') &&
           normalizeNovelIdentity((a.payload as any)?.name) === norm
    );
    const npcCanonicalId = matchingNpcAction && 'payload' in matchingNpcAction
      ? (matchingNpcAction.payload as any)?.id
      : canonicalState.worldInfo?.npcs?.find(n => normalizeNovelIdentity(n.name) === norm || normalizeNovelIdentity(n.id) === norm)?.id;

    // 1. Check proposal inventory actions for acquisition citing this NPC
    for (const action of proposal.actions) {
      if (action.type === 'MODIFY_INVENTORY' && (action.payload as any)?.acquisition) {
        const acq = (action.payload as any).acquisition;
        const itemPayload = (action.payload as any).item;

        const isSourceMatch = acq.sourceNpcId && (
          normalizeNovelIdentity(acq.sourceNpcId) === norm ||
          (npcCanonicalId && acq.sourceNpcId === npcCanonicalId)
        );

        if (isSourceMatch) {
          // Verify actual inventory mutation in Canonical State
          const isItemInInventory = canonicalState.character?.inventory?.some(
            invItem => (invItem.name && normalizeNovelIdentity(invItem.name) === normalizeNovelIdentity(itemPayload?.name)) ||
                       (invItem.id && itemPayload?.id && invItem.id === itemPayload.id)
          );
          if (!isItemInInventory) {
            continue; // Not committed to inventory, ignore
          }

          // Authoritative Event verification:
          // If verifiedEventId is provided, it MUST exist in authoritative events AND be causally related
          if (isNonEmptyString(acq.verifiedEventId)) {
            const authEv = findAuthoritativeEvent(acq.verifiedEventId, canonicalState, historicalRecords);
            if (!authEv.found || authEv.isActive === false) {
              continue; // Fake/unverified event ID, ignore
            }
            const isRelated = isAuthoritativeEventCausallyRelated(
              acq.verifiedEventId,
              { name: item.name, id: npcCanonicalId, entityType: 'NPC' },
              {
                itemName: itemPayload?.name,
                itemId: itemPayload?.id,
                sourceNpcId: acq.sourceNpcId,
                sourceNpcName: item.name
              },
              canonicalState,
              historicalRecords,
              proposal
            );
            if (!isRelated) {
              continue; // Authoritative event exists but is unrelated to this NPC or mutation, reject
            }
            return true;
          } else if (proposal.eventId) {
            // If no verifiedEventId was claimed, verify proposal.eventId and valid novelty cause
            const propEv = findAuthoritativeEvent(proposal.eventId, canonicalState, historicalRecords);
            if (propEv.found && propEv.isActive !== false) {
              if (acq.cause && VALID_NOVELTY_CAUSES.has(acq.cause)) {
                return true;
              }
            }
          }
        }
      }
    }

    // 2. Check proposal verified claims
    if (proposal.verifiedClaims && proposal.verifiedClaims.length > 0) {
      for (const vc of proposal.verifiedClaims) {
        if (
          (npcCanonicalId && vc.targetEntityId === npcCanonicalId) ||
          (vc.targetEntityId && normalizeNovelIdentity(vc.targetEntityId) === norm)
        ) {
          // Evidence IDs must actually exist in authoritative events / historical records AND be causally related!
          if (Array.isArray(vc.evidenceIds) && vc.evidenceIds.length > 0) {
            const hasRealEvidence = vc.evidenceIds.some(evId => {
              const auth = findAuthoritativeEvent(evId, canonicalState, historicalRecords);
              if (!auth.found || auth.isActive === false) return false;
              return isAuthoritativeEventCausallyRelated(
                evId,
                { name: item.name, id: npcCanonicalId, entityType: 'NPC' },
                undefined,
                canonicalState,
                historicalRecords,
                proposal
              );
            });
            if (hasRealEvidence) {
              return true;
            }
          }
        }
      }
    }

    // Fail-closed: bare ADD_NPC without causal evidence or fake signals
    return false;
  }

  if (item.entityType === 'ITEM') {
    const invAction = proposal.actions.find(
      a => a.type === 'MODIFY_INVENTORY' && (a.payload as any)?.item && normalizeNovelIdentity((a.payload as any).item.name) === norm
    );
    if (!invAction || !('payload' in invAction)) {
      return false;
    }

    const acq = (invAction.payload as any).acquisition;
    const itemData = (invAction.payload as any).item;

    // Bare MODIFY_INVENTORY without acquisition evidence fails-closed
    if (!acq) {
      return false;
    }

    // Verify item is actually in Canonical State inventory
    const isItemInInventory = canonicalState.character?.inventory?.some(
      invItem => (invItem.name && normalizeNovelIdentity(invItem.name) === norm) ||
                 (invItem.id && itemData?.id && invItem.id === itemData.id)
    );
    if (!isItemInInventory) {
      return false;
    }

    // Verify sourceNpcId if present: MUST exist in canonicalState NPCs or proposal ADD_NPC
    if (isNonEmptyString(acq.sourceNpcId)) {
      const sourceNorm = normalizeNovelIdentity(acq.sourceNpcId);
      const isRealNpc =
        canonicalState.worldInfo?.npcs?.some(n => normalizeNovelIdentity(n.name) === sourceNorm || normalizeNovelIdentity(n.id) === sourceNorm) ||
        proposal.actions.some(a => a.type === 'ADD_NPC' && (normalizeNovelIdentity((a.payload as any)?.name) === sourceNorm || (a.payload as any)?.id === acq.sourceNpcId));
      if (!isRealNpc) {
        return false; // Fake source NPC ID fails closed!
      }
    }

    // Verify verifiedEventId if present: MUST exist in authoritative events AND be causally related
    if (isNonEmptyString(acq.verifiedEventId)) {
      const authEv = findAuthoritativeEvent(acq.verifiedEventId, canonicalState, historicalRecords);
      if (!authEv.found || authEv.isActive === false) {
        return false; // Fake verifiedEventId fails closed!
      }
      const isRelated = isAuthoritativeEventCausallyRelated(
        acq.verifiedEventId,
        { name: item.name, id: itemData?.id, entityType: 'ITEM' },
        {
          itemName: item.name,
          itemId: itemData?.id,
          sourceNpcId: acq.sourceNpcId
        },
        canonicalState,
        historicalRecords,
        proposal
      );
      if (!isRelated) {
        return false; // Authoritative event is unrelated to this Item/mutation, fail closed!
      }
      return true;
    }

    // If sourceNpcId was valid and cause is valid novelty cause
    if (isNonEmptyString(acq.sourceNpcId) && acq.cause && VALID_NOVELTY_CAUSES.has(acq.cause)) {
      return true;
    }

    // If cost is valid structured object
    if (acq.cost && typeof acq.cost === 'object' && Object.keys(acq.cost).length > 0) {
      return true;
    }

    // Verify proposal event if cause is valid novelty cause
    if (proposal.eventId && acq.cause && VALID_NOVELTY_CAUSES.has(acq.cause)) {
      const propEv = findAuthoritativeEvent(proposal.eventId, canonicalState, historicalRecords);
      if (propEv.found && propEv.isActive !== false) {
        return true;
      }
    }

    return false;
  }

  if (item.entityType === 'FACTION') {
    const facAction = proposal.actions.find(
      a => a.type === 'ADD_FACTION' && normalizeNovelIdentity((a.payload as any)?.name) === norm
    );
    const facId = facAction && 'payload' in facAction ? (facAction.payload as any)?.id : undefined;
    if (proposal.verifiedClaims && proposal.verifiedClaims.length > 0 && facId) {
      return proposal.verifiedClaims.some(vc =>
        vc.targetEntityId === facId &&
        Array.isArray(vc.evidenceIds) &&
        vc.evidenceIds.some(evId => findAuthoritativeEvent(evId, canonicalState, historicalRecords).found)
      );
    }
    return false;
  }

  if (item.entityType === 'NARRATIVE_SEED') {
    const seedAction = proposal.actions.find(
      a => a.type === 'ADD_NARRATIVE_SEED' && normalizeNovelIdentity((a.payload as any)?.content) === norm
    );
    const seedId = seedAction && 'payload' in seedAction ? (seedAction.payload as any)?.id : undefined;
    if (proposal.verifiedClaims && proposal.verifiedClaims.length > 0 && seedId) {
      return proposal.verifiedClaims.some(vc =>
        vc.targetEntityId === seedId &&
        Array.isArray(vc.evidenceIds) &&
        vc.evidenceIds.some(evId => findAuthoritativeEvent(evId, canonicalState, historicalRecords).found)
      );
    }
    return false;
  }

  return false;
}

export function observeCandidateNovelHistory(
  existingRecords: readonly NovelHistoryRecord[],
  candidate: CandidatePacket,
  proposal: StateTransitionProposal,
  canonicalState: CanonicalState,
  storyTurnCount: number,
  historicalRecords: readonly ImmutableHistoricalRecord[] = []
): CandidateObservationResult {
  let records: NovelHistoryRecord[] = [...existingRecords];
  let promotedCount = 0;

  // 1. Collect Canonical IDs created or mutated in this turn's proposal
  const canonicalEntityIds = new Map<string, { entityType: CanonicalEntityReferenceType; canonicalId: string }>();

  for (const action of proposal.actions) {
    if (action.type === 'ADD_NPC' && action.payload?.name) {
      canonicalEntityIds.set(normalizeNovelIdentity(action.payload.name), {
        entityType: 'NPC',
        canonicalId: action.payload.id
      });
    } else if (action.type === 'MODIFY_INVENTORY' && action.payload?.item?.name) {
      canonicalEntityIds.set(normalizeNovelIdentity(action.payload.item.name), {
        entityType: 'ITEM',
        canonicalId: action.payload.item.id
      });
    } else if (action.type === 'ADD_FACTION' && action.payload?.name) {
      canonicalEntityIds.set(normalizeNovelIdentity(action.payload.name), {
        entityType: 'FACTION',
        canonicalId: action.payload.id
      });
    } else if (action.type === 'ADD_NARRATIVE_SEED' && action.payload?.content) {
      canonicalEntityIds.set(normalizeNovelIdentity(action.payload.content), {
        entityType: 'NARRATIVE_SEED',
        canonicalId: action.payload.id
      });
    }
  }

  // 2. Scan Candidate entities
  const candidatesToObserve: Array<{
    name: string;
    entityType: CanonicalEntityReferenceType;
  }> = [];

  if (Array.isArray(candidate.npcChanges)) {
    for (const npc of candidate.npcChanges) {
      if (npc?.name) candidatesToObserve.push({ name: npc.name, entityType: 'NPC' });
    }
  }

  if (Array.isArray(candidate.inventoryChanges)) {
    for (const item of candidate.inventoryChanges) {
      if (item?.name) candidatesToObserve.push({ name: item.name, entityType: 'ITEM' });
    }
  }

  if (Array.isArray((candidate as any).factions)) {
    for (const fac of (candidate as any).factions) {
      if (fac?.name) candidatesToObserve.push({ name: fac.name, entityType: 'FACTION' });
    }
  }

  if (Array.isArray((candidate as any).seeds)) {
    for (const seed of (candidate as any).seeds) {
      if (seed?.content) candidatesToObserve.push({ name: seed.content, entityType: 'NARRATIVE_SEED' });
    }
  }

  // 3. Perform Engine-derived observations on Candidate entities
  for (const item of candidatesToObserve) {
    const norm = normalizeNovelIdentity(item.name);
    if (!norm) continue;

    // Check if this entity is newly introduced in this turn's proposal
    const isNewCanon = canonicalEntityIds.has(norm);

    // Invariant: Existing Canon and Inactive Canon never become NOVEL
    if (!isNewCanon) {
      if (
        isActiveCanon(norm, item.entityType, canonicalState) ||
        isInactiveCanon(norm, item.entityType, canonicalState, historicalRecords)
      ) {
        continue;
      }
    } else {
      // For newly introduced canon entities, block if marked inactive (e.g. DEAD)
      if (isInactiveCanon(norm, item.entityType, canonicalState, historicalRecords)) {
        continue;
      }
    }

    // Determine if entity is an Engine-verified Active Actor (fails-closed if no causal evidence)
    const isActor = isEntityEngineVerifiedActiveActor(
      item,
      norm,
      candidate,
      proposal,
      canonicalState,
      historicalRecords
    );

    const canonicalInfo = canonicalEntityIds.get(norm);

    const observation: NovelHistoryObservation = {
      novelId: `nov-${item.entityType.toLowerCase()}-${norm.replace(/\s+/g, '-')}`,
      entityType: item.entityType,
      normalizedName: norm,
      displayName: item.name.trim(),
      turn: storyTurnCount,
      eventId: proposal.eventId,
      engineVerifiedActiveActor: isActor,
      isPassiveMentionOnly: !isActor
    };

    records = observeNovelHistory(
      records,
      observation,
      canonicalState,
      historicalRecords,
      { allowNewlyCommittedCanon: isNewCanon }
    );

    // Evaluate promotion
    const decision = evaluateCanonPromotion({
      activeActorInCanonicalChange: isActor,
      isPassiveMentionOnly: !isActor
    });

    if (decision.promote && canonicalInfo) {
      records = promoteNovelRecordToCanon(
        records,
        observation.novelId,
        item.entityType,
        canonicalInfo.canonicalId,
        storyTurnCount
      );
      promotedCount++;
    }
  }

  // 4. Directive D: Check existing Novel records that were not in candidatesToObserve,
  // but were verified as Active Actors in this turn's Canonical mutation (e.g., sourceNpcId in inventory exchange).
  for (const record of records) {
    if (record.lifecycle === 'NOVEL') {
      const isActor = isEntityEngineVerifiedActiveActor(
        { name: record.displayName || record.normalizedName, entityType: record.entityType },
        record.normalizedName,
        candidate,
        proposal,
        canonicalState,
        historicalRecords
      );

      if (isActor) {
        // Find canonical ID from this turn's proposal or canonical state
        let targetCanonicalId = canonicalEntityIds.get(record.normalizedName)?.canonicalId;
        if (!targetCanonicalId && record.entityType === 'NPC' && canonicalState.worldInfo?.npcs) {
          const matchedNpc = canonicalState.worldInfo.npcs.find(
            n => normalizeNovelIdentity(n.name) === record.normalizedName ||
                 normalizeNovelIdentity(n.id) === record.normalizedName
          );
          if (matchedNpc) {
            targetCanonicalId = matchedNpc.id;
          }
        }

        if (targetCanonicalId) {
          records = promoteNovelRecordToCanon(
            records,
            record.novelId,
            record.entityType,
            targetCanonicalId,
            storyTurnCount
          );
          promotedCount++;
        }
      }
    }
  }

  // 5. Invalidation / Demotion processing
  // Decoupled from proposal.verifiedClaims (which are generic claim verifications).
  // Evaluates strictly against proposal.identityInvalidationDeclarations and Sovereign Engine committed events.
  let demotedCount = 0;
  const declarations = proposal.identityInvalidationDeclarations;

  if (Array.isArray(declarations) && declarations.length > 0) {
    // Fail-closed: uncommitted proposals are ignored
    const isProposalCommitted =
      canonicalState.lastCommittedEventId === proposal.eventId ||
      historicalRecords.some(r => r.eventId === proposal.eventId || r.proposalId === proposal.proposalId);

    if (isProposalCommitted) {
      const processedEntityEvents = new Set<string>();

      for (const decl of declarations) {
        if (!decl.targetCanonicalId) continue;
        const targetEventId = decl.declaredEventId || proposal.eventId;
        const dedupeKey = `${decl.targetCanonicalId}:${targetEventId}`;
        if (processedEntityEvents.has(dedupeKey)) continue;

        // Prevent duplicate demotion for the same event
        const alreadyDemotedForEvent = records.some(
          r => (r.canonicalId === decl.targetCanonicalId || r.demotedFromCanonicalId === decl.targetCanonicalId) &&
               r.lifecycle === 'DEMOTED_NOVEL' &&
               r.sourceEventIds?.includes(targetEventId)
        );
        if (alreadyDemotedForEvent) {
          processedEntityEvents.add(dedupeKey);
          continue;
        }

        const targetName =
          decl.targetName ||
          canonicalState.worldInfo?.npcs?.find(n => n.id === decl.targetCanonicalId)?.name ||
          canonicalState.character?.inventory?.find(i => i.id === decl.targetCanonicalId)?.name ||
          canonicalState.worldInfo?.factions?.find(f => f.id === decl.targetCanonicalId)?.name ||
          decl.targetCanonicalId;

        const decision = evaluateCanonDemotion(
          {
            targetCanonicalId: decl.targetCanonicalId,
            entityType: decl.entityType || 'NPC',
            targetName,
            verifiedInvalidationEventId: targetEventId
          },
          canonicalState,
          historicalRecords
        );

        if (decision.demote) {
          const res = demoteCanonRecordToNovel(
            records,
            decl.targetCanonicalId,
            decl.entityType || 'NPC',
            targetName,
            storyTurnCount,
            decision.reason,
            decision.validatedEventId
          );
          records = [...res.updatedRecords];
          demotedCount++;
          processedEntityEvents.add(dedupeKey);
        }
      }
    }
  }

  return {
    updatedRecords: Object.freeze(records),
    promotedCount,
    demotedCount
  };
}


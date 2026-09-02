import type { CanonicalEntityReferenceType } from '../../types';

/**
 * Novel History is memory, not Canon.
 *
 * A Novel History record preserves a normalized identity candidate across turns without
 * granting it canonical authority. Canonical IDs are intentionally optional here.
 */
export type NovelHistoryLifecycle = 'NOVEL' | 'INACTIVE_NOVEL' | 'CANON_LINKED';

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
}

export interface NovelHistoryObservation {
  readonly novelId: string;
  readonly entityType: CanonicalEntityReferenceType;
  readonly normalizedName: string;
  readonly displayName: string;
  readonly turn: number;
  readonly eventId?: string;
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
  /** Engine-derived structural relationship to a Seed. Never an LLM boolean. */
  readonly deeplyRelatedToSeed: boolean;
  /** Engine-derived sustained/structural relationship to the protagonist. */
  readonly closelyRelatedToProtagonist: boolean;
}

export interface CanonPromotionDecision {
  readonly promote: boolean;
  readonly reason:
    | 'SEED_DEEP_RELATION'
    | 'PROTAGONIST_CLOSE_RELATION'
    | 'NO_CANON_PROMOTION_SIGNAL';
}

/** Normalizes the identity key used by Novel History. */
export function normalizeNovelIdentity(value: string): string {
  return value.trim().toLocaleLowerCase().normalize('NFKC').replace(/\s+/g, ' ');
}

/**
 * Novel -> Canon is a separate boundary from identity resolution.
 * Identity resolution answers "what is this?"; this gate answers "does this deserve
 * active Canon management?".
 */
export function evaluateCanonPromotion(
  signals: CanonPromotionSignals
): CanonPromotionDecision {
  if (signals.deeplyRelatedToSeed) {
    return { promote: true, reason: 'SEED_DEEP_RELATION' };
  }
  if (signals.closelyRelatedToProtagonist) {
    return { promote: true, reason: 'PROTAGONIST_CLOSE_RELATION' };
  }
  return { promote: false, reason: 'NO_CANON_PROMOTION_SIGNAL' };
}

/**
 * Downgrade is based on management relevance, not simple appearance count.
 *
 * Important: this does NOT erase Canon History or identity. It only says the entity no
 * longer needs to remain in the active management set. Reappearance can reactivate it.
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
 * Returns the canonical lifecycle transition allowed by this boundary.
 * No destructive deletion is performed here.
 */
export function classifyNovelHistoryLifecycle(
  record: Pick<NovelHistoryRecord, 'entityType' | 'lastRelevantTurn' | 'protagonistRelationActive' | 'lifecycle'>,
  currentTurn: number,
  policy: NovelHistoryPolicy = DEFAULT_NOVEL_HISTORY_POLICY
): NovelHistoryLifecycle {
  if (record.lifecycle === 'CANON_LINKED') return 'CANON_LINKED';
  if (isNovelHistoryInactive(record, currentTurn, policy)) return 'INACTIVE_NOVEL';
  return 'NOVEL';
}

/**
 * Pure reducer for one normalized Novel observation.
 * The reducer deliberately does not create a canonical ID.
 */
export function observeNovelHistory(
  existing: readonly NovelHistoryRecord[],
  observation: NovelHistoryObservation
): NovelHistoryRecord[] {
  const normalized = normalizeNovelIdentity(observation.normalizedName || observation.displayName);
  if (!normalized) return [...existing];

  const index = existing.findIndex(
    r => r.entityType === observation.entityType && r.normalizedName === normalized
  );

  if (index < 0) {
    const novel: NovelHistoryRecord = {
      novelId: observation.novelId,
      entityType: observation.entityType,
      normalizedName: normalized,
      displayName: observation.displayName.trim() || observation.normalizedName.trim(),
      firstSeenTurn: observation.turn,
      lastSeenTurn: observation.turn,
      lastRelevantTurn: observation.isManagementRelevant === false ? observation.turn : observation.turn,
      seenCount: 1,
      lifecycle: 'NOVEL',
      sourceEventIds: observation.eventId ? [observation.eventId] : [],
      relatedSeedIds: observation.relatedSeedId ? [observation.relatedSeedId] : [],
      protagonistRelationActive: observation.isRelevantToProtagonist === true
    };
    return [...existing, novel];
  }

  const current = existing[index];
  const sourceEventIds = observation.eventId && !current.sourceEventIds.includes(observation.eventId)
    ? [...current.sourceEventIds, observation.eventId]
    : [...current.sourceEventIds];
  const relatedSeedIds = observation.relatedSeedId && !current.relatedSeedIds.includes(observation.relatedSeedId)
    ? [...current.relatedSeedIds, observation.relatedSeedId]
    : [...current.relatedSeedIds];

  const next: NovelHistoryRecord = {
    ...current,
    lastSeenTurn: Math.max(current.lastSeenTurn, observation.turn),
    lastRelevantTurn:
      observation.isManagementRelevant === false
        ? current.lastRelevantTurn
        : Math.max(current.lastRelevantTurn, observation.turn),
    seenCount: current.seenCount + 1,
    lifecycle: 'NOVEL',
    sourceEventIds,
    relatedSeedIds,
    protagonistRelationActive:
      observation.isRelevantToProtagonist === true || current.protagonistRelationActive
  };

  return existing.map((record, i) => (i === index ? next : record));
}

/**
 * Reappearance never mints a second identity in Novel History.
 * The caller must pass the same normalized entity key and then let Identity Resolver
 * decide whether the reappearance reconnects to Canon.
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

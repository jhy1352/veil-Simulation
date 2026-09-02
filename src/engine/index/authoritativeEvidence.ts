/**
 * @file src/engine/index/authoritativeEvidence.ts
 * @description Single Source of Truth for Authoritative Event and Causal Evidence Verification.
 *
 * Grounded in Sovereign Engine Constitution:
 * 1. World reality is determined strictly by validated Canonical State and Historical Records.
 * 2. LLM / Proposal metadata (strings like verifiedEventId, sourceNpcId) are claims, NOT authorities.
 * 3. Authoritative verification checks whether an event/action actually exists and has causal validity.
 */

import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { EntityReferenceBundle } from '../../types';

export function normalizeIdentityText(value: string): string {
  if (!value || typeof value !== 'string') return '';
  return value.trim().toLocaleLowerCase().normalize('NFKC').replace(/\s+/g, ' ');
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export const VALID_NOVELTY_CAUSES = new Set([
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

export const CREATION_ACQUISITION_KEYWORDS = [
  '획득', '얻', '줍', '주웠', '발견', '받', '수여', '하사', '제작', '만듦', '만들',
  '구입', '구매', '샀', '전수', '건네', '주었', '주어', '보상', '노획', '탈취', '전리품',
  '창조', '생성', '생겨', '조우', '만남', '만나', '접함', '접견', '대면', '등장', '합류', '결성', '창설', '동행', '편입', '영구',
  '격퇴', '처치', '토벌', '소탕', '클리어', '탐색', '수색', '비경', '복선', '소문',
  'acquire', 'obtain', 'find', 'discover', 'receive', 'gift', 'reward', 'loot',
  'craft', 'create', 'buy', 'purchase', 'encounter', 'meet', 'defeat', 'drop', 'grant', 'give', 'armory', 'companion', 'welcome', 'starter'
];

/**
 * Resolves an authoritative event from historical records, offscreen records, seeds, or lastCommittedEventId.
 * Never trusts ungrounded strings.
 */
export function findAuthoritativeEvent(
  eventId: string,
  currentState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = []
): { found: boolean; eventText?: string; isActive?: boolean; record?: ImmutableHistoricalRecord } {
  const cleanId = eventId ? eventId.trim() : '';
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
export function checkCandidateSpecificity(
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

/**
 * Validates that the authoritative event and evidence actually prove the creation or acquisition
 * of the candidate entity (rather than a merely incidental or unrelated event).
 */
export function checkCreationOrAcquisitionProof(
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

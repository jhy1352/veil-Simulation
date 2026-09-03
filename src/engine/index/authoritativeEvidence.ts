/**
 * @file src/engine/index/authoritativeEvidence.ts
 * @description Single Source of Truth for Authoritative Event and Causal Evidence Verification.
 *
 * Grounded in Sovereign Engine Constitution:
 * 1. World reality is determined strictly by validated Canonical State and Historical Records.
 * 2. LLM / Proposal metadata (strings like verifiedEventId, sourceNpcId) are claims, NOT authorities.
 * 3. Authoritative verification checks whether an event/action actually exists and has causal validity.
 */

import { CanonicalState, ImmutableHistoricalRecord, StateTransitionProposal } from '../types';
import { EntityReferenceBundle, CanonicalEntityReferenceType } from '../../types';

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

/**
 * Checks if an authoritative event is causally related to a candidate entity and its mutation.
 *
 * Strict Invariants:
 * 1. An event is causally related if it is the current proposal's event (proposal.eventId)
 *    AND the proposal explicitly contains an action defining/modifying this entity or mutation.
 * 2. An external/historical authoritative event (seed, offscreen, camera, historical record)
 *    must specifically identify or mention the candidate entity (name/id), or the related mutation
 *    item/source NPC, proving that the event is the true historical origin/cause of the action.
 * 3. An event that exists but lacks any reference to the candidate entity/mutation is strictly
 *    unrelated (returns false).
 */
export function isAuthoritativeEventCausallyRelated(
  eventId: string,
  entity: { name: string; id?: string; entityType?: CanonicalEntityReferenceType },
  mutationDetails?: {
    itemName?: string;
    itemId?: string;
    sourceNpcId?: string;
    sourceNpcName?: string;
  },
  currentState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  currentProposal?: StateTransitionProposal
): boolean {
  const cleanEventId = eventId ? eventId.trim() : '';
  if (!cleanEventId) return false;

  // 1. Current Proposal Event Check:
  // If the eventId is the current proposal's event, the proposal must contain the canonical action
  // for this entity or mutation.
  if (currentProposal && currentProposal.eventId === cleanEventId) {
    const normEntityName = normalizeIdentityText(entity.name);

    if (entity.entityType === 'NPC') {
      const hasNpcAction = currentProposal.actions.some(a => {
        if (a.type === 'ADD_NPC' || a.type === 'UPDATE_NPC') {
          const pName = normalizeIdentityText((a.payload as any)?.name);
          const pId = (a.payload as any)?.id;
          return (normEntityName && pName === normEntityName) || (Boolean(entity.id) && pId === entity.id);
        }
        if (a.type === 'MODIFY_INVENTORY' && (a.payload as any)?.acquisition?.sourceNpcId) {
          const sNpc = (a.payload as any).acquisition.sourceNpcId;
          return (normEntityName && normalizeIdentityText(sNpc) === normEntityName) || (Boolean(entity.id) && sNpc === entity.id);
        }
        return false;
      });
      if (hasNpcAction) return true;
    }

    if (entity.entityType === 'ITEM') {
      const hasItemAction = currentProposal.actions.some(a => {
        if (a.type === 'MODIFY_INVENTORY' && (a.payload as any)?.item) {
          const iName = normalizeIdentityText((a.payload as any).item.name);
          const iId = (a.payload as any).item.id;
          return (normEntityName && iName === normEntityName) || (Boolean(entity.id) && iId === entity.id);
        }
        return false;
      });
      if (hasItemAction) return true;
    }
  }

  // 2. Seeds Check
  const seed = currentState?.worldInfo?.seeds?.find(s => s.id === cleanEventId);
  if (seed && seed.content) {
    if (checkCandidateSpecificity(entity.name, seed.content)) return true;
    if (entity.id && seed.content.includes(entity.id)) return true;
    if (mutationDetails?.itemName && checkCandidateSpecificity(mutationDetails.itemName, seed.content)) return true;
    if (mutationDetails?.sourceNpcName && checkCandidateSpecificity(mutationDetails.sourceNpcName, seed.content)) return true;
    if (mutationDetails?.sourceNpcId && seed.content.includes(mutationDetails.sourceNpcId)) return true;
  }

  // 3. Offscreen Records Check
  const offscreen = currentState?.worldInfo?.offscreenRecords?.find(o => o.id === cleanEventId);
  if (offscreen) {
    const offText = `${offscreen.eventDescription || ''} ${offscreen.location || ''} ${JSON.stringify(offscreen.involvedNpcIds || [])}`;
    if (checkCandidateSpecificity(entity.name, offText)) return true;
    if (entity.id && offText.includes(entity.id)) return true;
    if (mutationDetails?.itemName && checkCandidateSpecificity(mutationDetails.itemName, offText)) return true;
    if (mutationDetails?.sourceNpcName && checkCandidateSpecificity(mutationDetails.sourceNpcName, offText)) return true;
    if (mutationDetails?.sourceNpcId && offText.includes(mutationDetails.sourceNpcId)) return true;
  }

  // 4. Camera Offscreen Events Check
  const camera = currentState?.worldInfo?.cameraOffscreenEvents?.find(c => c === cleanEventId);
  if (camera) {
    if (checkCandidateSpecificity(entity.name, camera)) return true;
    if (entity.id && camera.includes(entity.id)) return true;
    if (mutationDetails?.itemName && checkCandidateSpecificity(mutationDetails.itemName, camera)) return true;
  }

  // 5. Historical Records Check (all records matching this eventId)
  const matchingRecords = historicalRecords.filter(r => r.eventId === cleanEventId || r.recordId === cleanEventId);
  for (const rec of matchingRecords) {
    // Check in record details
    if (rec.details) {
      if (checkCandidateSpecificity(entity.name, rec.details, rec)) return true;
      if (entity.id && rec.details.includes(entity.id)) return true;
      if (mutationDetails?.itemName && checkCandidateSpecificity(mutationDetails.itemName, rec.details, rec)) return true;
      if (mutationDetails?.itemId && rec.details.includes(mutationDetails.itemId)) return true;
      if (mutationDetails?.sourceNpcName && checkCandidateSpecificity(mutationDetails.sourceNpcName, rec.details, rec)) return true;
      if (mutationDetails?.sourceNpcId && rec.details.includes(mutationDetails.sourceNpcId)) return true;
    }

    // Check in canonicalAction
    if (rec.canonicalAction) {
      const actionJson = JSON.stringify(rec.canonicalAction);
      const cleanJson = actionJson.toLowerCase();
      const normEntity = normalizeIdentityText(entity.name);
      if (normEntity && cleanJson.includes(normEntity)) return true;
      if (entity.id && actionJson.includes(entity.id)) return true;
      if (mutationDetails?.itemName) {
        const normItem = normalizeIdentityText(mutationDetails.itemName);
        if (normItem && cleanJson.includes(normItem)) return true;
      }
      if (mutationDetails?.itemId && actionJson.includes(mutationDetails.itemId)) return true;
      if (mutationDetails?.sourceNpcName) {
        const normSrc = normalizeIdentityText(mutationDetails.sourceNpcName);
        if (normSrc && cleanJson.includes(normSrc)) return true;
      }
      if (mutationDetails?.sourceNpcId && actionJson.includes(mutationDetails.sourceNpcId)) return true;
    }
  }

  return false;
}


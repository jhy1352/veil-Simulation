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
  'RESOURCE_EXCHANGE','DISCOVERY_PICKUP','DISCOVERY','GIFT_REWARD','GIFT','REWARD','DUNGEON_REWARD','LOOT','PURCHASE','CRAFTING','ENCOUNTER','FIRST_ENCOUNTER','MET_DURING_STORY','ENCOUNTERED_NEW_FACTION','DISCOVERED_NARRATIVE_SEED','EAVESDROP','CREATION','EXPLORATION','GENESIS_STARTER','SYSTEM_INITIALIZATION'
]);

export const CREATION_ACQUISITION_KEYWORDS = [
  '획득','얻','줍','주웠','발견','받','수여','하사','제작','만듦','만들','구입','구매','샀','전수','건네','주었','주어','보상','노획','탈취','전리품','창조','생성','생겨','조우','만남','만나','접함','접견','대면','등장','합류','결성','창설','동행','편입','영구','격퇴','처치','토벌','소탕','클리어','탐색','수색','비경','복선','소문','acquire','obtain','find','discover','receive','gift','reward','loot','craft','create','buy','purchase','encounter','meet','defeat','drop','grant','give','armory','companion','welcome','starter'
];

export function findAuthoritativeEvent(
  eventId: string,
  currentState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = []
): { found: boolean; eventText?: string; isActive?: boolean; record?: ImmutableHistoricalRecord } {
  const cleanId = eventId ? eventId.trim() : '';
  if (!cleanId) return { found: false };

  const seed = currentState?.worldInfo?.seeds?.find(s => s.id === cleanId);
  if (seed) return { found: true, eventText: seed.content, isActive: seed.status === 'active' || seed.status === 'dormant' };

  const offscreen = currentState?.worldInfo?.offscreenRecords?.find(o => o.id === cleanId);
  if (offscreen) return { found: true, eventText: offscreen.eventDescription, isActive: true };

  const camera = currentState?.worldInfo?.cameraOffscreenEvents?.find(c => c === cleanId);
  if (camera) return { found: true, eventText: camera, isActive: true };

  const hist = historicalRecords.find(r => r.eventId === cleanId || r.recordId === cleanId);
  if (hist) return { found: true, eventText: hist.details, isActive: true, record: hist };

  if (currentState?.lastCommittedEventId === cleanId) return { found: true, eventText: undefined, isActive: true };
  return { found: false };
}

export function checkCandidateSpecificity(candidateName: string, eventText?: string, histRecord?: ImmutableHistoricalRecord): boolean {
  const cleanName = normalizeIdentityText(candidateName);
  if (!cleanName) return false;
  if (eventText) {
    const normEvent = normalizeIdentityText(eventText);
    if (normEvent.includes(cleanName)) return true;
    const KOREAN_PARTICLES = ['', '을','를','이','가','의','과','와','으로','로','도','에서','에게','이다','입니다','뿐','만'];
    const eventWords = normEvent.split(/[\s,.\-?!;:()\[\]{}"'`~]+/).filter(Boolean);
    if (eventWords.some(w => w === cleanName || (w.startsWith(cleanName) && KOREAN_PARTICLES.includes(w.slice(cleanName.length))))) return true;
  }
  if (histRecord?.canonicalAction) {
    const actionStr = JSON.stringify(histRecord.canonicalAction).toLowerCase();
    if (actionStr.includes(cleanName)) return true;
  }
  return false;
}

function isHistoryCreationOrAcquisitionRecord(record: ImmutableHistoricalRecord): boolean {
  if (
    record.actionType === 'ADD_NPC' ||
    record.actionType === 'ADD_FACTION' ||
    record.actionType === 'ADD_NARRATIVE_SEED' ||
    record.actionType === 'RECORD_OFFSCREEN_EVENT'
  ) return true;
  if (record.actionType === 'MODIFY_INVENTORY') {
    const operation = (record.canonicalAction as any)?.payload?.operation;
    return operation === 'ADD';
  }
  return false;
}

export function checkCreationOrAcquisitionProof(
  evidence: NonNullable<EntityReferenceBundle['evidence']>,
  eventText?: string,
  histRecord?: ImmutableHistoricalRecord
): boolean {
  if (evidence.cause) {
    if (!VALID_NOVELTY_CAUSES.has(evidence.cause)) {
      const causeUpper = evidence.cause.toUpperCase();
      const hasNoveltyRoot = ['REWARD','GIFT','DISCOVER','LOOT','ACQUIRE','CREATE','ENCOUNTER','MEET','BUY','CRAFT','SPAWN','STORY','FACTION','SEED','GENESIS','STARTER','COMPANION'].some(root => causeUpper.includes(root));
      if (!hasNoveltyRoot) return false;
    }
  }

  let hasProofInText = false;
  if (eventText) {
    const normEvent = normalizeIdentityText(eventText);
    hasProofInText = CREATION_ACQUISITION_KEYWORDS.some(kw => normEvent.includes(kw));
  }

  let hasProofInAction = false;
  if (histRecord && isHistoryCreationOrAcquisitionRecord(histRecord)) {
    hasProofInAction = true;
  }

  let hasProofInContext = false;
  if (isNonEmptyString(evidence.context)) {
    const normCtx = normalizeIdentityText(evidence.context);
    hasProofInContext = CREATION_ACQUISITION_KEYWORDS.some(kw => normCtx.includes(kw));
  }

  return hasProofInText || hasProofInAction || hasProofInContext;
}

export const CANONICAL_INVALIDATION_CAUSES: ReadonlySet<string> = new Set([
  'CANON_IDENTITY_INVALIDATION',
  'IDENTITY_INVALIDATION',
  'IDENTITY_FABRICATION',
  'IMPERSONATION',
  'FORGERY_DISCOVERED',
  'CANON_REVOCATION',
  'CANON_DEMOTION',
  'FORGERY_CONFISCATED',
  'INVALIDATION',
  'REVOCATION'
]);

export const INVALID_ENTITY_ROLES: ReadonlySet<string> = new Set([
  'IMPOSTOR',
  'FAKE',
  'FABRICATED',
  'UNMASKED_IMPOSTOR'
]);

export const INVALID_ENTITY_IDS: ReadonlySet<string> = new Set([
  'INVALID',
  'DEMOTED_NOVEL',
  'IMPOSTOR',
  'FABRICATED'
]);

export interface CurrentCausalAuthorityResolution {
  readonly hasAuthority: boolean;
  readonly found: boolean;
  readonly eventText?: string;
  readonly isInactive?: boolean;
  readonly isInvalidated?: boolean;
  readonly rejectionReason?: string;
  readonly conflictDetail?: string;
}

export function resolveCurrentCausalAuthority(
  eventId: string,
  currentState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  context?: {
    operation?: string;
    acquisitionCause?: string;
    targetItemName?: string;
    targetItemId?: string;
    sourceNpcId?: string;
  }
): CurrentCausalAuthorityResolution {
  const cleanId = eventId ? eventId.trim() : '';
  if (!cleanId) {
    return {
      hasAuthority: false,
      found: false,
      rejectionReason: 'MISSING_EVENT_ID',
      conflictDetail: 'verifiedEventId is missing or empty.'
    };
  }

  // 1. Provenance existence check in CanonicalState and Immutable History
  const matchingSeed = currentState?.worldInfo?.seeds?.find(s => s.id === cleanId);
  const matchingOff = currentState?.worldInfo?.offscreenRecords?.find(o => o.id === cleanId);
  const matchingCam = currentState?.worldInfo?.cameraOffscreenEvents?.find(c => c === cleanId);
  const matchingHist = historicalRecords.find(r => r.eventId === cleanId || r.recordId === cleanId);
  const isLastCommitted = currentState?.lastCommittedEventId === cleanId;

  const found = Boolean(matchingSeed || matchingOff || matchingCam || matchingHist || isLastCommitted);
  if (!found) {
    return {
      hasAuthority: false,
      found: false,
      rejectionReason: 'EVENT_NOT_FOUND',
      conflictDetail: `Event '${cleanId}' does not exist in canonical world state, seeds, offscreen records, or history.`
    };
  }

  const eventText = matchingSeed?.content || matchingOff?.eventDescription || matchingCam || matchingHist?.details;

  // 2. Authoritative Invalidation / Continuity Checks

  // A. Narrative Seed Status check
  if (matchingSeed) {
    if (matchingSeed.status === 'resolved') {
      return {
        hasAuthority: false,
        found: true,
        eventText,
        isInactive: true,
        rejectionReason: 'SEED_RESOLVED',
        conflictDetail: `Narrative seed '${cleanId}' has status 'resolved' and is no longer an active obtainable context.`
      };
    }
  }

  // B. Explicit Canonical Invalidation / Revocation in History
  for (const rec of historicalRecords) {
    if (rec.actionType === 'RESOLVE_NARRATIVE_SEED') {
      const payload = (rec.canonicalAction as any)?.payload;
      if (payload && payload.id === cleanId) {
        return {
          hasAuthority: false,
          found: true,
          eventText,
          isInactive: true,
          rejectionReason: 'SEED_RESOLVED_IN_HISTORY',
          conflictDetail: `Seed '${cleanId}' was canonically resolved in history (Record: ${rec.recordId || rec.eventId}).`
        };
      }
    }

    const action = rec.canonicalAction;
    if (action) {
      const payload = (action as any).payload;
      if (payload) {
        const payloadEventId = payload.verifiedEventId || payload.declaredEventId || payload.targetEventId || payload.id;
        const payloadCause = payload.cause || payload.invalidationCause || payload.acquisition?.cause;
        if (payloadEventId === cleanId && payloadCause && CANONICAL_INVALIDATION_CAUSES.has(String(payloadCause).trim().toUpperCase())) {
          return {
            hasAuthority: false,
            found: true,
            eventText,
            isInvalidated: true,
            rejectionReason: 'EVENT_REVOKED_IN_HISTORY',
            conflictDetail: `Event '${cleanId}' was canonically revoked or invalidated in history with cause '${payloadCause}'.`
          };
        }

        // Check nested entityReference in changes
        const refEvidence = payload.changes?.entityReference?.evidence;
        if (refEvidence) {
          const evId = refEvidence.verifiedEventId || refEvidence.declaredEventId;
          const evCause = refEvidence.cause;
          if (evId === cleanId && evCause && CANONICAL_INVALIDATION_CAUSES.has(String(evCause).trim().toUpperCase())) {
            return {
              hasAuthority: false,
              found: true,
              eventText,
              isInvalidated: true,
              rejectionReason: 'EVENT_REVOKED_IN_HISTORY',
              conflictDetail: `Event '${cleanId}' was canonically revoked or invalidated in history with cause '${evCause}'.`
            };
          }
        }
      }
    }

    if (rec.details && rec.details.includes(cleanId)) {
      for (const cause of CANONICAL_INVALIDATION_CAUSES) {
        if (rec.details.includes(cause)) {
          return {
            hasAuthority: false,
            found: true,
            eventText,
            isInvalidated: true,
            rejectionReason: 'EVENT_INVALIDATED_IN_DETAILS',
            conflictDetail: `Event '${cleanId}' was canonically recorded with invalidation cause '${cause}'.`
          };
        }
      }
    }
  }

  // C. Entity Continuity Invalidation (Involved NPC dead or unmasked as impostor/fabricated)
  const candidateNpcIds = new Set<string>();
  if (matchingOff?.involvedNpcIds && Array.isArray(matchingOff.involvedNpcIds)) {
    for (const id of matchingOff.involvedNpcIds) {
      if (id && typeof id === 'string') candidateNpcIds.add(id.trim());
    }
  }
  if (context?.sourceNpcId) {
    candidateNpcIds.add(context.sourceNpcId.trim());
  }

  const isGiftOrActiveInteraction = context?.acquisitionCause ? 
    ['GIFT_REWARD', 'GIFT', 'REWARD', 'PAYMENT', 'TRADE'].includes(String(context.acquisitionCause).trim().toUpperCase()) : 
    Boolean(context?.sourceNpcId);

  if (currentState?.worldInfo?.npcs) {
    for (const npc of currentState.worldInfo.npcs) {
      if (!npc.id) continue;
      if (candidateNpcIds.has(npc.id)) {
        if (npc.status === 'DEAD' && isGiftOrActiveInteraction) {
          return {
            hasAuthority: false,
            found: true,
            eventText,
            isInvalidated: true,
            rejectionReason: 'SOURCE_NPC_DEAD',
            conflictDetail: `Involved NPC '${npc.name || npc.id}' is DEAD in canonical state. Past promises or actions from this entity have lost current causal authority for gift/interaction.`
          };
        }

        const roleUpper = npc.role ? npc.role.trim().toUpperCase() : '';
        const resId = npc.entityReference?.resolvedEntityId ? npc.entityReference.resolvedEntityId.trim().toUpperCase() : '';
        const causeUpper = npc.entityReference?.evidence?.cause ? npc.entityReference.evidence.cause.trim().toUpperCase() : '';

        if (INVALID_ENTITY_ROLES.has(roleUpper) || INVALID_ENTITY_IDS.has(resId) || CANONICAL_INVALIDATION_CAUSES.has(causeUpper)) {
          return {
            hasAuthority: false,
            found: true,
            eventText,
            isInvalidated: true,
            rejectionReason: 'SOURCE_NPC_INVALIDATED',
            conflictDetail: `Involved NPC '${npc.name || npc.id}' has been canonically invalidated or unmasked as an impostor (${roleUpper || resId || causeUpper}).`
          };
        }
      } else if (eventText && npc.name && eventText.includes(npc.name)) {
        if (npc.status === 'DEAD' && isGiftOrActiveInteraction) {
          return {
            hasAuthority: false,
            found: true,
            eventText,
            isInvalidated: true,
            rejectionReason: 'SOURCE_NPC_DEAD',
            conflictDetail: `Named NPC '${npc.name}' in event '${cleanId}' is DEAD in canonical state. Past causal promises have lost authority for gift/interaction.`
          };
        }
        const roleUpper = npc.role ? npc.role.trim().toUpperCase() : '';
        if (INVALID_ENTITY_ROLES.has(roleUpper)) {
          return {
            hasAuthority: false,
            found: true,
            eventText,
            isInvalidated: true,
            rejectionReason: 'SOURCE_NPC_INVALIDATED',
            conflictDetail: `Named NPC '${npc.name}' in event '${cleanId}' has been canonically invalidated (${roleUpper}).`
          };
        }
      }
    }
  }

  // D. Offscreen Record Status and Causal Contract check
  if (matchingOff) {
    const offStatus = (matchingOff as any).status ? String((matchingOff as any).status).trim().toUpperCase() : '';
    if (offStatus === 'RESOLVED') {
      return {
        hasAuthority: false,
        found: true,
        eventText,
        isInactive: true,
        rejectionReason: 'OFFSCREEN_RESOLVED',
        conflictDetail: `Offscreen record '${cleanId}' has status 'RESOLVED' and is no longer an active context.`
      };
    }
    if (offStatus === 'INVALIDATED' || offStatus === 'REVOKED' || offStatus === 'SUPERSEDED') {
      return {
        hasAuthority: false,
        found: true,
        eventText,
        isInvalidated: true,
        rejectionReason: `OFFSCREEN_${offStatus}`,
        conflictDetail: `Offscreen record '${cleanId}' has explicit status '${offStatus}' and has lost causal authority.`
      };
    }

    // Causal contract check: Past isolated offscreen events without sourceNpcId cannot confer open deferred GIFT_REWARD minting
    if (context?.operation === 'ADD') {
      const cause = context.acquisitionCause ? String(context.acquisitionCause).trim().toUpperCase() : '';
      if (cause === 'GIFT_REWARD' || cause === 'GIFT' || cause === 'REWARD') {
        if (eventText) {
          const normText = normalizeIdentityText(eventText);
          const isDiscoveryOnly = normText.includes('발견') && !normText.includes('선물') && !normText.includes('주었') && !normText.includes('주어') && !normText.includes('제공') && !normText.includes('하사') && !normText.includes('건네');
          const isExplicitlyNegated = normText.includes('주지는 않았다') || normText.includes('주지 않았다');
          if (isDiscoveryOnly || isExplicitlyNegated) {
            return {
              hasAuthority: false,
              found: true,
              eventText,
              isInvalidated: true,
              rejectionReason: 'SEMANTIC_ACTION_MISMATCH',
              conflictDetail: `Event '${cleanId}' is a discovery/non-transfer occurrence ('${eventText}'). It cannot provide causal authority for GIFT_REWARD acquisition.`
            };
          }
        }

        const hasSourceNpc = Boolean(context?.sourceNpcId && context.sourceNpcId.trim());
        if (!hasSourceNpc) {
          return {
            hasAuthority: false,
            found: true,
            eventText,
            isInvalidated: true,
            rejectionReason: 'OFFSCREEN_EVENT_NOT_ACTIVE_SEED',
            conflictDetail: `Offscreen record '${cleanId}' is a historical offscreen occurrence without a specific source NPC. Deferred GIFT_REWARD mutations cannot be minted from past offscreen events without an active NPC interaction.`
          };
        }
      }
    }
  }

  // E. Target Item Invalidation check
  if (context?.targetItemName || context?.targetItemId) {
    const targetName = context.targetItemName ? normalizeIdentityText(context.targetItemName) : '';
    const targetId = context.targetItemId ? context.targetItemId.trim() : '';

    for (const rec of historicalRecords) {
      if (rec.actionType === 'MODIFY_INVENTORY') {
        const payload = (rec.canonicalAction as any)?.payload;
        const itemName = payload?.item?.name ? normalizeIdentityText(payload.item.name) : '';
        const itemId = payload?.item?.id ? payload.item.id.trim() : '';
        const cause = payload?.acquisition?.cause ? String(payload.acquisition.cause).trim().toUpperCase() : '';
        const refCause = payload?.item?.entityReference?.evidence?.cause ? String(payload.item.entityReference.evidence.cause).trim().toUpperCase() : '';

        if ((targetName && itemName === targetName) || (targetId && itemId === targetId)) {
          if (cause === 'FORGERY_CONFISCATED' || refCause === 'FORGERY_CONFISCATED' || CANONICAL_INVALIDATION_CAUSES.has(cause) || CANONICAL_INVALIDATION_CAUSES.has(refCause)) {
            return {
              hasAuthority: false,
              found: true,
              eventText,
              isInvalidated: true,
              rejectionReason: 'TARGET_ITEM_CONFISCATED_AS_FORGERY',
              conflictDetail: `Item '${context.targetItemName || context.targetItemId}' was canonically confiscated or invalidated as forgery in history.`
            };
          }
        }
      }
    }
  }

  // Authoritative validity holds (no arbitrary expiration by time/stateVersion)
  return {
    hasAuthority: true,
    found: true,
    eventText,
    isInactive: false,
    isInvalidated: false
  };
}

export function isAuthoritativeEventCausallyRelated(
  eventId: string,
  entity: { name: string; id?: string; entityType?: CanonicalEntityReferenceType },
  mutationDetails?: { itemName?: string; itemId?: string; sourceNpcId?: string; sourceNpcName?: string },
  currentState?: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  currentProposal?: StateTransitionProposal
): boolean {
  const cleanEventId = eventId ? eventId.trim() : '';
  if (!cleanEventId) return false;
  if (currentProposal && currentProposal.eventId === cleanEventId) {
    const normEntityName = normalizeIdentityText(entity.name);
    if (entity.entityType === 'NPC') {
      const hasNpcAction = currentProposal.actions.some(a => {
        if (a.type === 'ADD_NPC' || a.type === 'UPDATE_NPC') {
          const pName = normalizeIdentityText((a.payload as any)?.name); const pId = (a.payload as any)?.id;
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
          const iName = normalizeIdentityText((a.payload as any).item.name); const iId = (a.payload as any).item.id;
          return (normEntityName && iName === normEntityName) || (Boolean(entity.id) && iId === entity.id);
        }
        return false;
      });
      if (hasItemAction) return true;
    }
  }

  const seed = currentState?.worldInfo?.seeds?.find(s => s.id === cleanEventId);
  if (seed && seed.content) {
    if (checkCandidateSpecificity(entity.name, seed.content)) return true;
    if (entity.id && seed.content.includes(entity.id)) return true;
    if (mutationDetails?.itemName && checkCandidateSpecificity(mutationDetails.itemName, seed.content)) return true;
    if (mutationDetails?.sourceNpcName && checkCandidateSpecificity(mutationDetails.sourceNpcName, seed.content)) return true;
    if (mutationDetails?.sourceNpcId && seed.content.includes(mutationDetails.sourceNpcId)) return true;
  }
  const offscreen = currentState?.worldInfo?.offscreenRecords?.find(o => o.id === cleanEventId);
  if (offscreen) {
    const offText = `${offscreen.eventDescription || ''} ${offscreen.location || ''} ${JSON.stringify(offscreen.involvedNpcIds || [])}`;
    if (checkCandidateSpecificity(entity.name, offText)) return true;
    if (entity.id && offText.includes(entity.id)) return true;
    if (mutationDetails?.itemName && checkCandidateSpecificity(mutationDetails.itemName, offText)) return true;
    if (mutationDetails?.sourceNpcName && checkCandidateSpecificity(mutationDetails.sourceNpcName, offText)) return true;
    if (mutationDetails?.sourceNpcId && offText.includes(mutationDetails.sourceNpcId)) return true;
  }
  const camera = currentState?.worldInfo?.cameraOffscreenEvents?.find(c => c === cleanEventId);
  if (camera) {
    if (checkCandidateSpecificity(entity.name, camera)) return true;
    if (entity.id && camera.includes(entity.id)) return true;
    if (mutationDetails?.itemName && checkCandidateSpecificity(mutationDetails.itemName, camera)) return true;
    if (mutationDetails?.sourceNpcName && checkCandidateSpecificity(mutationDetails.sourceNpcName, camera)) return true;
  }
  const matchingRecords = historicalRecords.filter(r => r.eventId === cleanEventId || r.recordId === cleanEventId);
  for (const rec of matchingRecords) {
    if (!isHistoryCreationOrAcquisitionRecord(rec)) continue;
    if (rec.details) {
      if (checkCandidateSpecificity(entity.name, rec.details, rec)) return true;
      if (entity.id && rec.details.includes(entity.id)) return true;
      if (mutationDetails?.itemName && checkCandidateSpecificity(mutationDetails.itemName, rec.details, rec)) return true;
      if (mutationDetails?.itemId && rec.details.includes(mutationDetails.itemId)) return true;
      if (mutationDetails?.sourceNpcName && checkCandidateSpecificity(mutationDetails.sourceNpcName, rec.details, rec)) return true;
      if (mutationDetails?.sourceNpcId && rec.details.includes(mutationDetails.sourceNpcId)) return true;
    }
    if (rec.canonicalAction) {
      const actionJson = JSON.stringify(rec.canonicalAction); const cleanJson = actionJson.toLowerCase(); const normEntity = normalizeIdentityText(entity.name);
      if (normEntity && cleanJson.includes(normEntity)) return true;
      if (entity.id && actionJson.includes(entity.id)) return true;
      if (mutationDetails?.itemName && cleanJson.includes(normalizeIdentityText(mutationDetails.itemName))) return true;
      if (mutationDetails?.itemId && actionJson.includes(mutationDetails.itemId)) return true;
      if (mutationDetails?.sourceNpcName && cleanJson.includes(normalizeIdentityText(mutationDetails.sourceNpcName))) return true;
      if (mutationDetails?.sourceNpcId && actionJson.includes(mutationDetails.sourceNpcId)) return true;
    }
  }
  return false;
}

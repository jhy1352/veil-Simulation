import type { CanonicalEntityReferenceType, Character, WorldInfo } from '../../types';
import type { CanonicalState, ImmutableHistoricalRecord } from '../types';
import type { NovelHistoryRecord } from './novelHistory';

/**
 * Identity Passport is a derived continuity index.
 *
 * Sovereignty rules:
 * - ImmutableHistoricalRecord remains the historical source of truth.
 * - CanonicalState remains the current-world authority.
 * - Passport never authorizes or mutates a state transition.
 * - Passport stamps reference existing historical records; they do not copy history.
 */
export type PassportHistoryDomain = 'CANON' | 'NOVEL';
export type PassportStatus = 'ACTIVE' | 'RETIRED';

export interface PassportStamp {
  readonly stampId: string;
  readonly recordId: string;
  readonly eventId: string;
}

export interface EntityPassport {
  readonly entityId: string;
  readonly historyDomain: PassportHistoryDomain;
  readonly passportVersion: number;
  readonly status: PassportStatus;
  readonly predecessorPassportId?: string;
  readonly stamps: readonly PassportStamp[];
}

export interface PassportState {
  readonly passports: readonly EntityPassport[];
}

interface EntityDescriptor {
  readonly entityId: string;
  readonly entityType: CanonicalEntityReferenceType;
  readonly domain: PassportHistoryDomain;
}

/**
 * Stable synthetic identity for the player character, whose Character model has no id field.
 */
export const CHARACTER_PASSPORT_ID = 'character:protagonist';

function makeStamp(record: ImmutableHistoricalRecord, index: number): PassportStamp {
  return Object.freeze({
    stampId: `stamp-${record.recordId}-${index + 1}`,
    recordId: record.recordId,
    eventId: record.eventId
  });
}

function addDescriptor(map: Map<string, EntityDescriptor>, descriptor: EntityDescriptor): void {
  if (!descriptor.entityId) return;
  if (!map.has(descriptor.entityId)) {
    map.set(descriptor.entityId, descriptor);
  }
}

/**
 * Extracts authoritative entity references from the committed canonical action.
 * This intentionally uses canonicalAction rather than LLM claims or free-form prose.
 */
function extractCanonicalEntityDescriptors(record: ImmutableHistoricalRecord): EntityDescriptor[] {
  const action = record.canonicalAction;
  let payload: any = action?.payload;

  if (!payload && record.details) {
    try {
      const jsonMatch = record.details.match(/\{.*\}/);
      if (jsonMatch) payload = JSON.parse(jsonMatch[0]);
    } catch {
      // ignore malformed details
    }
  }

  const descriptors = new Map<string, EntityDescriptor>();

  const add = (entityId: unknown, entityType: CanonicalEntityReferenceType) => {
    if (typeof entityId !== 'string' || !entityId.trim()) return;
    addDescriptor(descriptors, {
      entityId: entityId.trim(),
      entityType,
      domain: 'CANON'
    });
  };

  switch (record.actionType) {
    case 'ADD_NPC':
    case 'UPDATE_NPC':
    case 'SET_NPC_STATUS':
      add(payload?.id, 'NPC');
      break;
    case 'ADD_FACTION':
    case 'UPDATE_FACTION':
      add(payload?.id, 'FACTION');
      break;
    case 'ADD_NARRATIVE_SEED':
    case 'RESOLVE_NARRATIVE_SEED':
      add(payload?.id, 'NARRATIVE_SEED');
      break;
    case 'UPDATE_CHARACTER_STATS':
    case 'SET_CHARACTER_SECRET':
    case 'RECORD_PHYSICAL_DEFECT':
    case 'RECORD_DICE_RESULT':
      add(CHARACTER_PASSPORT_ID, 'CHARACTER');
      break;
    case 'OVERWRITE_CHARACTER':
      add(CHARACTER_PASSPORT_ID, 'CHARACTER');
      for (const item of Array.isArray(payload?.inventory) ? payload.inventory : []) {
        add(item?.id, 'ITEM');
      }
      break;
    case 'MODIFY_INVENTORY':
      add(CHARACTER_PASSPORT_ID, 'CHARACTER');
      add(payload?.item?.id, 'ITEM');
      if (payload?.acquisition?.sourceNpcId) {
        add(payload.acquisition.sourceNpcId, 'NPC');
      }
      if (payload?.acquisition?.cost?.id) {
        add(payload.acquisition.cost.id, 'ITEM');
      }
      break;
    case 'RECORD_OFFSCREEN_EVENT':
      add(payload?.factionId, 'FACTION');
      for (const npcId of Array.isArray(payload?.involvedNpcIds) ? payload.involvedNpcIds : []) {
        add(npcId, 'NPC');
      }
      break;
    case 'OVERWRITE_WORLD_INFO':
      for (const npc of Array.isArray(payload?.npcs) ? payload.npcs : []) {
        add(npc?.id, 'NPC');
      }
      for (const faction of Array.isArray(payload?.factions) ? payload.factions : []) {
        add(faction?.id, 'FACTION');
      }
      for (const seed of Array.isArray(payload?.seeds) ? payload.seeds : []) {
        add(seed?.id, 'NARRATIVE_SEED');
      }
      break;
    default:
      break;
  }

  return [...descriptors.values()];
}

function currentCanonicalDescriptors(
  character: Character,
  worldInfo: WorldInfo
): EntityDescriptor[] {
  const descriptors: EntityDescriptor[] = [];

  if (character?.name) {
    descriptors.push({
      entityId: CHARACTER_PASSPORT_ID,
      entityType: 'CHARACTER',
      domain: 'CANON'
    });
  }

  for (const npc of worldInfo?.npcs || []) {
    if (npc?.id) {
      descriptors.push({ entityId: npc.id, entityType: 'NPC', domain: 'CANON' });
    }
  }
  for (const faction of worldInfo?.factions || []) {
    if (faction?.id) {
      descriptors.push({ entityId: faction.id, entityType: 'FACTION', domain: 'CANON' });
    }
  }
  for (const item of character?.inventory || []) {
    if (item?.id) {
      descriptors.push({ entityId: item.id, entityType: 'ITEM', domain: 'CANON' });
    }
  }
  for (const seed of worldInfo?.seeds || []) {
    if (seed?.id) {
      descriptors.push({ entityId: seed.id, entityType: 'NARRATIVE_SEED', domain: 'CANON' });
    }
  }

  return descriptors;
}

/**
 * Determines whether a Canon entity is currently active in CanonicalState.
 * Non-active entities are classified as RETIRED:
 * - Dead NPCs (status === 'DEAD')
 * - Consumed / 0-quantity or removed Items
 * - Resolved, dormant, or archived Narrative Seeds
 * - Past historical entities no longer present in CanonicalState
 */
function isCanonicalEntityActive(
  descriptor: EntityDescriptor,
  canonicalState: CanonicalState
): boolean {
  if (descriptor.domain !== 'CANON') return false;

  switch (descriptor.entityType) {
    case 'CHARACTER':
      return Boolean(canonicalState.character?.name);
    case 'NPC':
      return (canonicalState.worldInfo?.npcs || []).some(
        npc => npc?.id === descriptor.entityId && npc.status !== 'DEAD'
      );
    case 'FACTION':
      return (canonicalState.worldInfo?.factions || []).some(
        fac => fac?.id === descriptor.entityId
      );
    case 'ITEM':
      return (canonicalState.character?.inventory || []).some(
        item => item?.id === descriptor.entityId && (item.quantity ?? 0) > 0
      );
    case 'NARRATIVE_SEED':
      return (canonicalState.worldInfo?.seeds || []).some(seed => {
        if (seed?.id !== descriptor.entityId) return false;
        const s = (seed.status as string) || '';
        return s !== 'resolved' && s !== 'RESOLVED' && s !== 'dormant' && s !== 'ARCHIVED';
      });
    default:
      return false;
  }
}

/**
 * Builds the Passport projection from authoritative history and
 * the currently authoritative CanonicalState.
 *
 * NovelHistory is used only to identify Novel-domain entities. It does not become
 * a second source of historical truth: its sourceEventIds are resolved against the
 * immutable historical ledger before stamps are emitted.
 */
export function projectPassports(
  canonicalState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  novelHistoryRecords: readonly NovelHistoryRecord[] = []
): PassportState {
  const canonDescriptors = new Map<string, EntityDescriptor>();

  // 1. Current Canon entities (including inactive/dead, which will receive RETIRED status)
  for (const descriptor of currentCanonicalDescriptors(canonicalState.character, canonicalState.worldInfo)) {
    addDescriptor(canonDescriptors, descriptor);
  }

  // 2. Historical records: extract entity references from authoritative actions
  const recordsByEntity = new Map<string, ImmutableHistoricalRecord[]>();
  const recordsByEventId = new Map<string, ImmutableHistoricalRecord[]>();

  for (const record of historicalRecords) {
    // Index by eventId for Novel sourceEventId resolution
    if (record.eventId) {
      const eventList = recordsByEventId.get(record.eventId) || [];
      eventList.push(record);
      recordsByEventId.set(record.eventId, eventList);
    }

    for (const descriptor of extractCanonicalEntityDescriptors(record)) {
      const list = recordsByEntity.get(descriptor.entityId) || [];
      list.push(record);
      recordsByEntity.set(descriptor.entityId, list);
      addDescriptor(canonDescriptors, descriptor);
    }
  }

  // 3. Map Novel predecessors and demotions for lineage tracking
  const novelPredecessorByCanonicalId = new Map<string, NovelHistoryRecord>();
  const demotedNovelByCanonicalId = new Map<string, NovelHistoryRecord>();
  for (const novel of novelHistoryRecords) {
    if (novel?.canonicalId && novel.lifecycle === 'CANON_LINKED') {
      novelPredecessorByCanonicalId.set(novel.canonicalId, novel);
      // Ensure promoted Canon entity descriptor is registered
      if (!canonDescriptors.has(novel.canonicalId)) {
        addDescriptor(canonDescriptors, {
          entityId: novel.canonicalId,
          entityType: novel.entityType,
          domain: 'CANON'
        });
      }
    }
    if (novel?.demotedFromCanonicalId && novel.lifecycle === 'DEMOTED_NOVEL') {
      demotedNovelByCanonicalId.set(novel.demotedFromCanonicalId, novel);
      // Ensure demoted Canon entity descriptor is registered so its historical passport is preserved
      if (!canonDescriptors.has(novel.demotedFromCanonicalId)) {
        addDescriptor(canonDescriptors, {
          entityId: novel.demotedFromCanonicalId,
          entityType: novel.entityType,
          domain: 'CANON'
        });
      }
    }
  }

  const passports: EntityPassport[] = [];

  // 4. Project CANON Passports
  for (const descriptor of canonDescriptors.values()) {
    const sourceRecords = recordsByEntity.get(descriptor.entityId) || [];
    const stamps = sourceRecords.map((record, index) => makeStamp(record, index));

    const novelPredecessor = novelPredecessorByCanonicalId.get(descriptor.entityId);
    const hasPredecessor = Boolean(novelPredecessor);
    const passportVersion = hasPredecessor ? 2 : 1;
    const predecessorPassportId = novelPredecessor ? novelPredecessor.novelId : undefined;

    const isDemoted = demotedNovelByCanonicalId.has(descriptor.entityId);
    const isActive = !isDemoted && isCanonicalEntityActive(descriptor, canonicalState);
    const status: PassportStatus = isActive ? 'ACTIVE' : 'RETIRED';

    passports.push(Object.freeze({
      entityId: descriptor.entityId,
      historyDomain: 'CANON',
      passportVersion,
      status,
      predecessorPassportId,
      stamps: Object.freeze(stamps)
    }));
  }

  // 5. Project NOVEL Passports
  for (const novel of novelHistoryRecords) {
    if (!novel?.novelId) continue;

    // Resolve stamps strictly against immutable historical records using sourceEventIds
    const novelRecords: ImmutableHistoricalRecord[] = [];
    const seenRecordIds = new Set<string>();

    for (const eventId of novel.sourceEventIds || []) {
      const matching = recordsByEventId.get(eventId) || [];
      for (const rec of matching) {
        if (!seenRecordIds.has(rec.recordId)) {
          seenRecordIds.add(rec.recordId);
          novelRecords.push(rec);
        }
      }
    }

    const stamps = novelRecords.map((record, index) => makeStamp(record, index));

    // Novel lifecycle mapping:
    // - NOVEL: Active candidate -> ACTIVE
    // - INACTIVE_NOVEL: Demoted by inactivity policy -> RETIRED
    // - CANON_LINKED: Promoted to Canon (superseded by Canon passport) -> RETIRED
    // - DEMOTED_NOVEL: Authoritatively demoted to Novel domain -> ACTIVE
    let status: PassportStatus = 'ACTIVE';
    if (novel.lifecycle === 'CANON_LINKED' || novel.lifecycle === 'INACTIVE_NOVEL') {
      status = 'RETIRED';
    } else if (novel.lifecycle === 'DEMOTED_NOVEL') {
      status = 'ACTIVE';
    }

    const hasCanonPredecessor = Boolean(novel.demotedFromCanonicalId);
    const predecessorPassportId = novel.demotedFromCanonicalId || undefined;
    const latestVersion = novel.transitionHistory && novel.transitionHistory.length > 0
      ? novel.transitionHistory[novel.transitionHistory.length - 1]?.version
      : undefined;
    const passportVersion = latestVersion ?? (hasCanonPredecessor ? 2 : 1);

    passports.push(Object.freeze({
      entityId: novel.novelId,
      historyDomain: 'NOVEL',
      passportVersion,
      status,
      predecessorPassportId,
      stamps: Object.freeze(stamps)
    }));
  }

  // Deterministic sorting: CANON domain first, then NOVEL; alphabetical by entityId
  passports.sort((a, b) => {
    if (a.historyDomain !== b.historyDomain) return a.historyDomain === 'CANON' ? -1 : 1;
    return a.entityId.localeCompare(b.entityId);
  });

  return Object.freeze({ passports: Object.freeze(passports) });
}

/**
 * Convenience overload for callers that already have the engine snapshot.
 */
export function projectPassportsFromHistory(
  snapshot: CanonicalState,
  history: readonly ImmutableHistoricalRecord[],
  novelHistoryRecords: readonly NovelHistoryRecord[] = []
): PassportState {
  return projectPassports(snapshot, history, novelHistoryRecords);
}

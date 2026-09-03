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
  if (!action) return [];

  const payload: any = action.payload;
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
      add(payload?.id, 'NPC');
      break;
    case 'UPDATE_NPC':
    case 'SET_NPC_STATUS':
      add(payload?.id, 'NPC');
      break;
    case 'ADD_FACTION':
      add(payload?.id, 'FACTION');
      break;
    case 'UPDATE_FACTION':
      add(payload?.id, 'FACTION');
      break;
    case 'ADD_NARRATIVE_SEED':
      add(payload?.id, 'NARRATIVE_SEED');
      break;
    case 'RESOLVE_NARRATIVE_SEED':
      add(payload?.id, 'NARRATIVE_SEED');
      break;
    case 'UPDATE_CHARACTER_STATS':
    case 'SET_CHARACTER_SECRET':
    case 'RECORD_PHYSICAL_DEFECT':
    case 'OVERWRITE_CHARACTER':
      add(CHARACTER_PASSPORT_ID, 'CHARACTER');
      break;
    case 'MODIFY_INVENTORY':
      add(CHARACTER_PASSPORT_ID, 'CHARACTER');
      add(payload?.item?.id, 'ITEM');
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
    if (npc?.id) descriptors.push({ entityId: npc.id, entityType: 'NPC', domain: 'CANON' });
  }
  for (const faction of worldInfo?.factions || []) {
    if (faction?.id) descriptors.push({ entityId: faction.id, entityType: 'FACTION', domain: 'CANON' });
  }
  for (const item of character?.inventory || []) {
    if (item?.id && (item.quantity ?? 0) > 0) {
      descriptors.push({ entityId: item.id, entityType: 'ITEM', domain: 'CANON' });
    }
  }
  for (const seed of worldInfo?.seeds || []) {
    if (seed?.id && seed.status !== 'resolved' && seed.status !== 'dormant') {
      descriptors.push({ entityId: seed.id, entityType: 'NARRATIVE_SEED', domain: 'CANON' });
    }
  }

  return descriptors;
}

/**
 * Builds the first-generation Passport projection from authoritative history and
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
  const descriptors = new Map<string, EntityDescriptor>();

  // Current Canon entities always receive an active Canon passport.
  for (const descriptor of currentCanonicalDescriptors(canonicalState.character, canonicalState.worldInfo)) {
    addDescriptor(descriptors, descriptor);
  }

  // Novel entities receive a Novel passport unless they are already linked to Canon.
  for (const novel of novelHistoryRecords) {
    if (!novel?.novelId || novel.lifecycle === 'CANON_LINKED') continue;
    addDescriptor(descriptors, {
      entityId: novel.novelId,
      entityType: novel.entityType,
      domain: 'NOVEL'
    });
  }

  const recordsByEntity = new Map<string, ImmutableHistoricalRecord[]>();
  for (const record of historicalRecords) {
    for (const descriptor of extractCanonicalEntityDescriptors(record)) {
      const list = recordsByEntity.get(descriptor.entityId) || [];
      list.push(record);
      recordsByEntity.set(descriptor.entityId, list);
      addDescriptor(descriptors, descriptor);
    }
  }

  const passports: EntityPassport[] = [];

  for (const descriptor of descriptors.values()) {
    const sourceRecords = recordsByEntity.get(descriptor.entityId) || [];
    const stamps = sourceRecords.map((record, index) => makeStamp(record, index));

    passports.push(Object.freeze({
      entityId: descriptor.entityId,
      historyDomain: descriptor.domain,
      passportVersion: 1,
      status: 'ACTIVE',
      stamps: Object.freeze(stamps)
    }));
  }

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
